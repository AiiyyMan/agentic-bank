import { supabase } from './supabase';
import type { HealthCheck, AgentResponse, ConfirmResponse, ChatRequest } from '@agentic-bank/shared';
import { parseSSEStream, type SSEEvent } from './streaming';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function refreshAndGetHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) {
    throw new Error('Session expired. Please sign in again.');
  }
  return {
    'Authorization': `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  };
}

const REQUEST_TIMEOUT_MS = 15_000;
const CHAT_TIMEOUT_MS = 45_000; // Agent loop can take 30s+ for multi-tool turns
const STREAM_TIMEOUT_MS = 60_000; // Streaming: allow longer for full agent loop

// Serialise concurrent 401 refreshes — only one refresh in flight at a time
let _refreshPromise: Promise<Record<string, string>> | null = null;

async function refreshAndRetry(): Promise<Record<string, string>> {
  if (!_refreshPromise) {
    _refreshPromise = refreshAndGetHeaders().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      signal: controller.signal,
    });

    // 401 — token expired; refresh once and retry (serialised via _refreshPromise)
    if (response.status === 401 && !retried) {
      const refreshedHeaders = await refreshAndRetry();
      clearTimeout(timeout);
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), timeoutMs);
      try {
        const retryResponse = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: { ...refreshedHeaders, ...options.headers },
          signal: retryController.signal,
        });
        if (!retryResponse.ok) {
          const errorBody = await retryResponse.text();
          throw new Error(`API error ${retryResponse.status}: ${errorBody}`);
        }
        return retryResponse.json() as Promise<T>;
      } finally {
        clearTimeout(retryTimeout);
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

// Health check (no auth required)
export async function healthCheck(): Promise<HealthCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal: controller.signal });
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Chat — routes through apiRequest for 401 refresh + serialised lock
export async function sendChatMessage(request: ChatRequest): Promise<AgentResponse> {
  return apiRequest<AgentResponse>(
    '/api/chat',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    false,
    CHAT_TIMEOUT_MS,
  );
}

// Streaming chat — yields SSEEvents as they arrive from /api/chat/stream
export async function* streamChatMessage(
  request: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  // Use a queue + resolve pattern so parseSSEStream (callback-based) can feed an AsyncGenerator
  const queue: SSEEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let streamDone = false;
  let streamError: Error | null = null;

  function enqueue(event: SSEEvent): void {
    queue.push(event);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  }

  async function runStream(): Promise<void> {
    let headers: Record<string, string>;
    try {
      headers = await getAuthHeaders();
    } catch {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    // Merge caller's signal with our timeout signal
    const combinedSignal = signal
      ? (AbortSignal as any).any
        ? (AbortSignal as any).any([signal, controller.signal])
        : controller.signal
      : controller.signal;

    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: combinedSignal,
      });
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }

    if (response.status === 401) {
      clearTimeout(timeout);
      // Refresh once and retry
      const refreshedHeaders = await refreshAndRetry();
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), STREAM_TIMEOUT_MS);
      try {
        response = await fetch(`${API_URL}/api/chat/stream`, {
          method: 'POST',
          headers: refreshedHeaders,
          body: JSON.stringify(request),
          signal: retryController.signal,
        });
      } finally {
        clearTimeout(retryTimeout);
      }
    }

    if (!response.ok) {
      clearTimeout(timeout);
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    try {
      await parseSSEStream(response, enqueue, combinedSignal);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Run the stream in the background, signalling done/error when finished
  runStream().then(() => {
    streamDone = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  }).catch((err: Error) => {
    streamError = err;
    streamDone = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  });

  // Yield events as they arrive
  while (true) {
    if (queue.length > 0) {
      yield queue.shift()!;
    } else if (streamDone) {
      if (streamError) throw streamError;
      return;
    } else {
      // Wait for next event or completion
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
    }
  }
}

// Confirm pending action
export async function confirmAction(pendingActionId: string): Promise<ConfirmResponse> {
  return apiRequest(`/api/confirm/${pendingActionId}`, {
    method: 'POST',
  });
}

// Reject pending action
export async function rejectAction(pendingActionId: string): Promise<ConfirmResponse> {
  return apiRequest(`/api/confirm/${pendingActionId}/reject`, {
    method: 'POST',
  });
}

// Onboarding — mock-compatible bulk flow (uses BankingPort, works with USE_MOCK_BANKING=true)
export async function startOnboarding(data: {
  givenName: string;
  surname: string;
  dateOfBirth: string;
  addressLine1: string;
  city: string;
  postalCode: string;
}): Promise<{ success: boolean; profile: any }> {
  return apiRequest('/api/onboarding/start', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Griffin-backed onboarding (USE_MOCK_BANKING=false only)
export async function submitOnboarding(data: {
  givenName: string;
  surname: string;
  dateOfBirth: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string;
}): Promise<{ success: boolean; profile: any }> {
  return apiRequest('/api/auth/onboard', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get user profile
export async function getProfile(): Promise<any> {
  return apiRequest('/api/auth/profile');
}

// Loans
export async function getLoanProducts(): Promise<any> {
  return apiRequest('/api/loans/products');
}

export async function getLoans(): Promise<any> {
  return apiRequest('/api/loans');
}

export async function getLoan(id: string): Promise<any> {
  return apiRequest(`/api/loans/${id}`);
}

export async function getCreditScore(): Promise<any> {
  return apiRequest('/api/loans/credit-score');
}

export async function getLoanApplications(): Promise<any> {
  return apiRequest('/api/loans/applications');
}

// Direct banking endpoints (bypass agent loop)
export async function getBalance(accountId?: string): Promise<any> {
  const query = accountId && accountId !== 'main' ? `?account_id=${encodeURIComponent(accountId)}` : '';
  return apiRequest(`/api/balance${query}`);
}

export async function getTransactions(limit?: number, accountId?: string): Promise<any> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (accountId && accountId !== 'main') params.set('account_id', accountId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/transactions${query}`);
}

// Onboarding
export async function getOnboardingStatus(): Promise<any> {
  return apiRequest('/api/onboarding/status');
}

export async function getOnboardingChecklist(): Promise<any> {
  return apiRequest('/api/onboarding/checklist');
}

export async function verifyIdentity(): Promise<any> {
  return apiRequest('/api/onboarding/verify', { method: 'POST' });
}

// Insights
export async function getSpendingBreakdown(startDate?: string, endDate?: string): Promise<any> {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const query = params.toString() ? `?${params}` : '';
  return apiRequest(`/api/insights/spending${query}`);
}

export async function getWeeklySummary(): Promise<any> {
  return apiRequest('/api/insights/weekly');
}

export async function getProactiveCards(): Promise<any> {
  return apiRequest('/api/insights/proactive');
}

// Pots
export async function getPots(): Promise<any> {
  return apiRequest('/api/pots');
}

// Beneficiaries
export async function getBeneficiaries(): Promise<any> {
  return apiRequest('/api/beneficiaries');
}

// Flex plans
export async function getFlexPlans(): Promise<any> {
  return apiRequest('/api/flex/plans');
}

// Pending actions resurfacing (EXI-06c)
export async function getPendingActions(): Promise<{ pending_actions: any[] }> {
  return apiRequest('/api/pending-actions');
}

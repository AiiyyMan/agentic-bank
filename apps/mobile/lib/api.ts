import { supabase } from './supabase';
import type { HealthCheck, AgentResponse, ConfirmResponse, ChatRequest } from '@agentic-bank/shared';

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

const REQUEST_TIMEOUT_MS = 15_000;

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      signal: controller.signal,
    });

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

// Chat
export async function sendChatMessage(request: ChatRequest): Promise<AgentResponse> {
  return apiRequest('/api/chat', {
    method: 'POST',
    body: JSON.stringify(request),
  });
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

// Onboarding
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

export async function getLoanApplications(): Promise<any> {
  return apiRequest('/api/loans/applications');
}

// Direct banking endpoints (bypass agent loop)
export async function getBalance(): Promise<any> {
  return apiRequest('/api/balance');
}

export async function getTransactions(limit?: number): Promise<any> {
  const query = limit ? `?limit=${limit}` : '';
  return apiRequest(`/api/transactions${query}`);
}

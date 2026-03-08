# Offline & Caching Strategy

> **Phase 2 Output** | Senior Mobile Architect | March 2026
>
> Defines the on-device data strategy for AgentBank: what to cache, where to store it, how to detect connectivity, and how to degrade gracefully. Pragmatic and sequenced — POC scope first, production hardening later.

---

## 1. Requirements Audit

### 1.1 Existing Architecture Commitments

The system-architecture.md already specifies an offline/caching baseline. This document upgrades and formalises those commitments.

| Commitment (system-architecture.md) | Status | This Document |
|--------------------------------------|--------|---------------|
| Zustand persist with AsyncStorage | **Upgrade** | → MMKV (ADR-14, §2) |
| Per-store persistence policy (chat ~200KB, accounts ~50KB, insights ~30KB) | **Keep** | Sizes validated, policy retained |
| Staleness thresholds (30s accounts, 5min insights) | **Formalise** | → TanStack Query staleTime (§3) |
| Offline behavior table (view balance, send message, confirm action) | **Keep** | Unchanged — conservative approach correct for banking |
| Reconnect priority: auth → accounts → chat → insights | **Keep** | Implemented via TanStack Query refetchOnReconnect |
| `ConnectionStatus` type (connected/reconnecting/offline) | **Upgrade** | → NetInfo-backed with captive portal detection (§4) |
| V3 Foundation validation (persist/rehydrate < 200ms) | **Keep** | Target unchanged, MMKV makes it trivially achievable |
| Stream recovery (§3.5) with heartbeat/timeout/retry | **Keep** | No changes — works independently of caching layer |

### 1.2 Requirements by Priority

**P0 — POC must-haves:**

| # | Requirement | Rationale |
|---|-------------|-----------|
| C1 | Sub-200ms rehydration, sub-300ms first meaningful paint | Users see last-known balance instantly, not a loading spinner |
| C2 | Graceful offline degradation for read operations | "Updated 5 min ago" badge, not a crash or blank screen |
| C3 | Clear offline blocking for write operations | No optimistic money movement — show "try again when connected" |
| C4 | Connectivity detection with UI indicator | Users must know they're offline before attempting actions |
| C5 | Secure storage for auth tokens | SecureStore for JWT, not plaintext AsyncStorage |
| C6 | Stream interruption recovery | Already specified in system-architecture.md §3.5 |

**P1 — Post-POC:**

| # | Requirement | Rationale |
|---|-------------|-----------|
| C7 | Encrypted on-device cache for financial data | App store expectation, regulatory best practice |
| C8 | Background refresh of balances | Notification badge accuracy, "glanceable" home screen |
| C9 | Offline message drafting with send-on-reconnect | UX polish — save the user's intent |
| C10 | Cache size management and eviction | Prevent unbounded storage growth |

**P2 — Production hardening:**

| # | Requirement | Rationale |
|---|-------------|-----------|
| C11 | Selective sync (only changed data since last fetch) | Bandwidth efficiency on slow connections |
| C12 | Conflict resolution for stale confirmations | Edge case: user confirms offline, balance changed server-side |

### 1.3 What We Explicitly Do NOT Cache

| Data | Reason |
|------|--------|
| Full card numbers (PAN) | PCI-DSS prohibits at-rest storage on device |
| CVV/CVC | Never stored, even transiently |
| KYC documents | Uploaded and discarded — no local copy |
| Griffin API tokens | Server-side only, never exposed to client |
| Raw Anthropic API responses | Only the parsed message/tool_call output is persisted |

---

## 2. Storage Layer — MMKV over AsyncStorage

### ADR-14: Use react-native-mmkv for On-Device Persistence

**Status:** Proposed
**Context:** The existing architecture specifies AsyncStorage for Zustand persist. AsyncStorage is async, unencrypted, uses JSON serialization, and benchmarks at ~50-100ms for typical reads. For a banking app that needs fast rehydration and encrypted storage, this is insufficient.

**Decision:** Use `react-native-mmkv` (v3+) as the storage backend for all Zustand persist stores and TanStack Query persistence.

**Comparison:**

| Dimension | AsyncStorage | react-native-mmkv |
|-----------|-------------|-------------------|
| Speed | ~50-100ms read | ~1-3ms read (~30x faster) |
| API | Async (Promise) | Synchronous |
| Encryption | None | AES-128-CFB built-in (see §2.6 for limitations) |
| Size limits | 6MB default on Android | Limited by device storage |
| Expo Go | Works | **Requires dev build** |
| Bundle size | ~0 (built-in) | ~50KB native module |

**Consequences:**

- (+) Rehydration target (< 200ms) becomes trivially achievable (~5ms for 200KB)
- (+) Built-in AES-128-CFB encryption provides defense-in-depth for cached data (see §2.6 for scope and limitations)
- (+) Synchronous reads simplify store initialization (no async hydration race)
- (-) Requires `npx expo prebuild` — Expo Go no longer works for development
- (-) Team must set up dev builds from day 1 of Foundation

**Requires product decision:** None — this is a pure technical upgrade. The existing persistence policy (what to store, staleness thresholds) remains unchanged.

### 2.1 MMKV Instance Architecture

Separate MMKV instances by security tier. Each instance has its own encryption key stored in SecureStore.

```
┌──────────────────────────────────────────────────────┐
│                   On-Device Storage                   │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Tier 1: expo-secure-store                      │ │
│  │  (Keychain / Android Keystore)                  │ │
│  │                                                  │ │
│  │  • JWT access token (< 2KB)                     │ │
│  │  • JWT refresh token                            │ │
│  │  • MMKV encryption keys                         │ │
│  │  • Biometric enrollment flag                    │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Tier 2: MMKV — encrypted instance "financial"  │ │
│  │  (AES-128-CFB, key from SecureStore)            │ │
│  │                                                  │ │
│  │  • accounts store (balances, pots, beneficiaries)│ │
│  │  • insights store (proactive cards, spending)   │ │
│  │  • TanStack Query persisted cache               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Tier 2b: MMKV — encrypted instance "chat"     │ │
│  │  (AES-128-CFB, key from SecureStore)            │ │
│  │                                                  │ │
│  │  • chat store (messages with embedded           │ │
│  │    ui_components containing financial data)     │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Tier 3: MMKV — unencrypted instance "app"     │ │
│  │                                                  │ │
│  │  • UI preferences (theme, onboarding state)     │ │
│  │  • feature flags cache                          │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Why three MMKV instances?** Chat messages contain embedded `ui_components` with financial data (balances, transaction amounts) from tool call results, so they must be encrypted. Separating instances by domain means a corruption in one doesn't affect the others. The unencrypted `app` instance holds only non-sensitive UI preferences.

### 2.2 MMKV Setup

```typescript
// lib/storage.ts
import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Encryption key management
// IMPORTANT: MMKV accepts a max 16-byte (128-bit) encryption key.
// We generate exactly 16 random bytes via expo-crypto's native CSPRNG
// (iOS: SecRandomCopyBytes, Android: SecureRandom) and hex-encode
// to a 32-char string. The key is stored in SecureStore (hardware-backed
// Keychain on iOS, Android Keystore on Android).
//
// Do NOT use crypto.getRandomValues() — it is not available in Hermes
// without a polyfill. expo-crypto provides the same security guarantees
// via native platform APIs.
async function getOrCreateEncryptionKey(keyId: string): Promise<string> {
  let key = await SecureStore.getItemAsync(keyId);
  if (!key) {
    const randomBytes = await Crypto.getRandomBytesAsync(16); // 128-bit
    key = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''); // 32-char hex string
    await SecureStore.setItemAsync(keyId, key);
  }
  return key;
}

// Initialised at app startup (before store hydration)
export let financialStorage: MMKV;
export let chatStorage: MMKV;
export let appStorage: MMKV;

export async function initStorage(): Promise<void> {
  const financialKey = await getOrCreateEncryptionKey('mmkv-financial-key');
  const chatKey = await getOrCreateEncryptionKey('mmkv-chat-key');

  financialStorage = new MMKV({
    id: 'financial',
    encryptionKey: financialKey,
  });

  chatStorage = new MMKV({
    id: 'chat',
    encryptionKey: chatKey,
    // Encrypted — messages contain embedded financial data via ui_components
  });

  appStorage = new MMKV({
    id: 'app',
    // No encryption — UI prefs, feature flags only
  });
}
```

### 2.3 Zustand Persist with MMKV

```typescript
// stores/accounts.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { financialStorage } from '../lib/storage';

// MMKV → Zustand storage adapter
const mmkvStorage = {
  getItem: (name: string) => {
    const value = financialStorage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    financialStorage.set(name, value);
  },
  removeItem: (name: string) => {
    financialStorage.delete(name);
  },
};

const useAccountsStore = create(
  persist(
    (set) => ({
      balances: [],
      pots: [],
      beneficiaries: [],
      lastSyncedAt: null,
      // ... actions
    }),
    {
      name: 'accounts-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        balances: state.balances,
        pots: state.pots,
        beneficiaries: state.beneficiaries,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
```

### 2.4 Updated Per-Store Persistence Policy

This supersedes the table in system-architecture.md §2.2:

| Store | MMKV Instance | Encrypted | Persisted Fields | Max Size | Staleness |
|-------|---------------|-----------|------------------|----------|-----------|
| `accounts` | `financial` | Yes | Balances, pots, beneficiaries, lastSyncedAt | ~50KB | 30s |
| `insights` | `financial` | Yes | Proactive cards, spending breakdown, lastSyncedAt | ~30KB | 5min |
| `chat` | `chat` | Yes | Last 100 messages, conversation list | ~200KB | N/A (append-only) |
| `auth` | SecureStore | Yes (OS) | JWT tokens, user profile ID | < 2KB | N/A (token expiry) |
| `notification` | `app` | No | Badge count, feed open state | < 1KB | N/A (real-time) |

### 2.5 Data Wipe on Sign-Out

On sign-out, all cached data must be cleared. This prevents the next user on a shared device from seeing the previous user's financial data.

```typescript
// In auth store sign-out action:
async function signOut() {
  // 1. Clear Supabase session
  await supabase.auth.signOut();

  // 2. Clear all MMKV instances
  financialStorage.clearAll();
  chatStorage.clearAll();
  appStorage.clearAll();

  // 3. Clear SecureStore tokens and encryption keys (rotate on next sign-in)
  await SecureStore.deleteItemAsync('jwt-access-token');
  await SecureStore.deleteItemAsync('jwt-refresh-token');
  await SecureStore.deleteItemAsync('mmkv-financial-key');
  await SecureStore.deleteItemAsync('mmkv-chat-key');
  // Keys are regenerated by getOrCreateEncryptionKey() on next sign-in

  // 4. Reset Zustand stores to initial state
  useAccountsStore.getState().reset();
  useChatStore.getState().reset();
  useInsightsStore.getState().reset();
}
```

### 2.6 MMKV Encryption: What It Provides and What It Doesn't

> **This section is required reading for all builders.** MMKV's built-in encryption is a defense-in-depth layer, not a standalone security solution. Understanding its scope prevents false confidence and informs the production security roadmap (§14).

**What MMKV encryption is:**

- **Algorithm:** AES-128-CFB (Cipher Feedback mode, 128-bit key). Implemented via OpenSSL in Tencent's MMKV C++ core.
- **Scope:** File-level encryption. Both keys and values are encrypted together in MMKV's memory-mapped protobuf file.
- **Key handling:** The `encryptionKey` string (max 16 bytes) is passed directly to OpenSSL's `AES_set_encrypt_key`. No key derivation function (KDF) is applied — the key you provide IS the AES key material.
- **IV:** Stored in a separate metafile alongside a CRC32 checksum.

**What MMKV encryption is NOT:**

| Property | MMKV | Bank-grade |
|----------|------|------------|
| Algorithm strength | AES-128 | AES-256 |
| Cipher mode | CFB (confidentiality only) | GCM or CCM (confidentiality + authenticity) |
| Key derivation | None — raw key used directly | PBKDF2/Argon2 with high iteration count |
| Integrity verification | CRC32 (not cryptographic) | HMAC-SHA256 or AEAD tag |
| Key size | 16 bytes max | 32 bytes (256-bit) |
| Tamper detection | None — attacker can modify encrypted file | Authenticated encryption detects tampering |
| In-memory protection | Decrypted data lives in mmap'd memory | Requires memory encryption or secure enclaves |

**Known vulnerabilities:**

- **CVE-2024-21668** (react-native-mmkv < 2.11.0): Encryption key was logged to Android system logs (ADB-accessible). CVSS 4.9. **Mitigation:** Use v3.0+ which includes the fix. Pin minimum version in `package.json`.
- **No authenticated encryption:** An attacker with file system access (rooted device, backup extraction) could modify the encrypted file. MMKV would decrypt corrupted data without error (CRC32 is not a cryptographic integrity check). **Mitigation:** Acceptable for POC — cached data is display-only and validated server-side before any action.

**Why this is acceptable for the POC:**

1. **Defense-in-depth, not sole protection.** OS sandboxing is the primary barrier. MMKV encryption adds a second layer that defeats casual file system browsing and basic backup extraction.
2. **Cached data is display-only.** No financial decisions are made from cached data. All mutations (payments, transfers) require a live server round-trip that validates current state.
3. **Keys are hardware-backed.** The 128-bit AES key is stored in SecureStore (iOS Keychain / Android Keystore), backed by Secure Enclave / TEE where available. Extracting the key requires device compromise beyond file system access.
4. **No PANs or credentials cached.** The most sensitive data (card numbers, CVV, KYC documents, API tokens) is never stored on-device (§1.3).
5. **AES-128 is PCI DSS compliant.** PCI DSS 4.0 accepts AES-128+. The FCA is principles-based and does not mandate specific algorithms.
6. **Production upgrade path is clear.** §14 documents the roadmap to AES-256-GCM via SQLCipher for financial data post-POC.

**Dependencies:**

| Package | Min Version | Why |
|---------|------------|-----|
| `react-native-mmkv` | `3.0.0` | CVE-2024-21668 fix, stable API |
| `expo-crypto` | SDK 53+ | `getRandomBytesAsync()` for CSPRNG key generation |
| `expo-secure-store` | SDK 53+ | Hardware-backed key storage |

---

## 3. Server State Management — TanStack Query

### ADR-15: Use TanStack Query for Server State Caching

**Status:** Proposed
**Context:** The current architecture uses Zustand for all client state, including server-fetched data (balances, transactions, insights). This conflates two concerns: UI state (which message is selected, is the drawer open) and server state (what's my balance, what are my transactions). Zustand is excellent for the former but lacks built-in staleness management, background refetching, deduplication, and retry logic for the latter.

**Decision:** Adopt `@tanstack/react-query` (v5) for all server-fetched data. Zustand remains for UI state and chat (which is a hybrid — server-persisted but locally appended during streaming).

**Consequences:**

- (+) Built-in staleTime/gcTime replaces manual `lastSyncedAt` tracking
- (+) `refetchOnReconnect` implements the reconnect priority order automatically
- (+) Request deduplication — multiple components reading `['accounts', 'balance']` share one request
- (+) Offline support via `networkMode: 'offlineFirst'` — serves cache, then refetches when online
- (-) Additional dependency (~30KB gzipped)
- (-) Team needs to learn TanStack Query patterns (but well-documented, widely adopted)

**Requires product decision:** None.

### 3.1 Query Configuration

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { financialStorage } from './storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default: consider data fresh for 30 seconds
      staleTime: 30 * 1000,
      // Keep unused data in memory for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Serve cache first, refetch in background when online
      networkMode: 'offlineFirst',
      // Retry 2 times with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Refetch when app comes to foreground (requires AppState bridge below)
      refetchOnWindowFocus: true,
      // Refetch when network reconnects (requires NetInfo bridge in §4.1)
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutations require connectivity — no offline queuing for money movement
      networkMode: 'online',
    },
  },
});

// Persist query cache to MMKV for instant app launch
const mmkvPersister = createSyncStoragePersister({
  storage: {
    getItem: (key: string) => financialStorage.getString(key) ?? null,
    setItem: (key: string, value: string) => financialStorage.set(key, value),
    removeItem: (key: string) => financialStorage.delete(key),
  },
  // Only persist queries with these keys
  filter: (query) => {
    const persistableKeys = ['accounts', 'transactions', 'pots', 'insights', 'beneficiaries'];
    return persistableKeys.some(k => (query.queryKey as string[]).includes(k));
  },
});
```

### 3.2 Query Definitions by Domain

```typescript
// hooks/queries/useAccounts.ts
import { useQuery } from '@tanstack/react-query';

export function useBalance() {
  return useQuery({
    queryKey: ['accounts', 'balance'],
    queryFn: () => api.get('/api/accounts/balance'),
    staleTime: 30 * 1000,   // Fresh for 30s (matches existing spec)
  });
}

export function useTransactions(accountId: string, page = 1) {
  return useQuery({
    queryKey: ['transactions', accountId, page],
    queryFn: () => api.get(`/api/accounts/${accountId}/transactions?page=${page}`),
    staleTime: 60 * 1000,   // Fresh for 1 minute
    placeholderData: keepPreviousData, // Keep showing page 1 while page 2 loads
  });
}

// hooks/queries/useInsights.ts
export function useProactiveCards() {
  return useQuery({
    queryKey: ['insights', 'proactive-cards'],
    queryFn: () => api.get('/api/insights/proactive'),
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes (matches existing spec)
  });
}
```

### 3.3 Staleness Display

TanStack Query provides `dataUpdatedAt` on every query result, replacing the manual `lastSyncedAt` field:

```typescript
function BalanceCard() {
  const { data, dataUpdatedAt, isFetching, isStale } = useBalance();

  return (
    <View>
      <Text className="text-3xl font-semibold text-primary">
        £{formatCurrency(data?.available)}
      </Text>
      {isStale && !isFetching && (
        <Text className="text-xs text-secondary">
          Updated {formatRelativeTime(dataUpdatedAt)}
        </Text>
      )}
      {isFetching && (
        <ActivityIndicator size="small" />
      )}
    </View>
  );
}
```

### 3.4 Zustand vs TanStack Query Boundary

| Data Type | Owner | Why |
|-----------|-------|-----|
| Account balances, pots, transactions | TanStack Query | Pure server state with staleness semantics |
| Beneficiaries list | TanStack Query | Server state, rarely changes |
| Proactive insight cards | TanStack Query | Server-computed, cacheable |
| Loan details, repayment schedule | TanStack Query | Server state |
| Chat messages | Zustand (persist) | Hybrid — locally appended during SSE, server-persisted after |
| Chat streaming state (IDLE/SENDING/THINKING/...) | Zustand (no persist) | Pure UI state |
| Auth session | Zustand + SecureStore | Needs synchronous access for request interceptors |
| Connection status | Zustand (no persist) | Derived from NetInfo, pure UI state |
| Notification badge count | Zustand (persist) | Updated by Knock WebSocket, simple counter |
| UI preferences (theme, onboarding step) | Zustand (persist) | Local-only, no server equivalent |

---

## 4. Connectivity Detection — NetInfo

### 4.1 NetInfo Setup

```typescript
// lib/connectivity.ts
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

// Configure NetInfo
NetInfo.configure({
  // Custom reachability check — catches captive portals
  reachabilityUrl: 'https://api.agentic.bank/api/health',
  reachabilityTest: async (response) => response.status === 200,
  reachabilityLongTimeout: 30 * 1000,  // 30s when offline
  reachabilityShortTimeout: 5 * 1000,  // 5s when online
  reachabilityRequestTimeout: 10 * 1000,
});

// Bridge NetInfo → TanStack Query's onlineManager
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    // Both must be true — isConnected alone doesn't catch captive portals
    const isOnline = !!(state.isConnected && state.isInternetReachable);
    setOnline(isOnline);
  });
});

// Bridge AppState → TanStack Query's focusManager
// (React Native has no window.focus event — must wire manually)
import { AppState } from 'react-native';
import { focusManager } from '@tanstack/react-query';

AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active');
});
```

### 4.2 Connection Status Store

```typescript
// stores/connectivity.ts
import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';
// Matches system-architecture.md §3.5

interface ConnectivityStore {
  status: ConnectionStatus;
  lastOnlineAt: number | null;
}

const useConnectivityStore = create<ConnectivityStore>((set, get) => ({
  status: 'connected', // Assume connected on launch
  lastOnlineAt: Date.now(),
}));

// Subscribe to NetInfo on app start
let previouslyOnline = true;

NetInfo.addEventListener((state) => {
  const isConnected = !!state.isConnected;
  const isReachable = state.isInternetReachable;
  const isOnline = isConnected && isReachable === true;

  if (isOnline && !previouslyOnline) {
    // Just came back online
    useConnectivityStore.setState({
      status: 'connected',
      lastOnlineAt: Date.now(),
    });
  } else if (isConnected && isReachable === null) {
    // Connected to network but reachability probe in flight
    // (e.g., transitioning from offline, or captive portal check pending)
    useConnectivityStore.setState({ status: 'reconnecting' });
  } else if (!isConnected) {
    useConnectivityStore.setState({ status: 'offline' });
  }

  previouslyOnline = isOnline;
});
```

**Note on `reconnecting`:** The `reconnecting` state serves two purposes: (1) NetInfo reports `isConnected: true` but `isInternetReachable: null` during the reachability probe — this is the transitional state, and (2) SSE stream retry logic (system-architecture.md §3.5) sets `reconnecting` in the chat store's `connectionStatus` during retry attempts. Both map to the same yellow-dot UI indicator.

### 4.3 Offline UI Patterns

These patterns supersede the offline behavior table in system-architecture.md §2.2 (which incorrectly implied offline message drafting at P0 — "Message saved — I'll respond when you're back." That is deferred to P1, requirement C9):

| User Action | Online | Offline |
|-------------|--------|---------|
| View balance | TanStack Query fetches fresh | TanStack Query serves cache + staleness badge |
| View transactions | Fresh fetch, paginated | Cached transactions + "Showing cached data" banner |
| View conversation | Latest messages from server | Full cached history from Zustand persist |
| Send message | SSE stream | Disabled send button + "You're offline" toast |
| Confirm action | Execute via API | Disabled confirm button + "Please try again when you're connected" |
| View proactive cards | Fresh fetch | Last cards + "From your last session" badge |

**Blocking vs. non-blocking:** Read operations degrade gracefully (serve cache). Write operations are blocked entirely. This is a deliberate banking-safety decision — we never optimistically mutate financial state.

---

## 5. On-Device vs. Server Data Split

### 5.1 Data Residency Table

| Data | On-Device | Server | Notes |
|------|-----------|--------|-------|
| Account balances | Cached (encrypted MMKV) | Supabase + Griffin | Cache is display-only, never used for decisions |
| Transaction history | Cached (last 50 per account) | Supabase | Paginated — only recent transactions cached |
| Pot balances & goals | Cached (encrypted MMKV) | Supabase + Griffin | |
| Beneficiary list | Cached (encrypted MMKV) | Supabase | |
| Chat messages | Cached (last 100, encrypted MMKV) | Supabase `messages` table | Full history on server, recent in local cache |
| Conversation metadata | Cached (active only) | Supabase `conversations` table | P1: cache list of past conversations |
| Proactive insight cards | Cached | Supabase `user_insights_cache` | Pre-computed server-side |
| AI agent state | None | Server-side only | Tool calls, pending_actions — never cached |
| Pending actions | None | Supabase `pending_actions` | Confirmation state lives server-side only |
| Loan details | Cached (encrypted MMKV) | Supabase | |
| Push token | None (managed by Knock) | Knock | |
| User preferences | Cached (Zustand persist) | Knock PreferenceSet (P1) | Notification prefs synced to Knock |

### 5.2 Cache Size Budget

Total on-device budget: **< 5MB** (well within any device constraint).

| Store | Estimated Size | Items |
|-------|---------------|-------|
| Accounts + pots + beneficiaries | ~50KB | ~5 accounts, ~10 pots, ~20 beneficiaries |
| Transactions (cached pages) | ~200KB | ~50 transactions × 4 accounts |
| Chat messages | ~200KB | ~100 messages with ui_components |
| Insight cards | ~30KB | ~10 proactive cards |
| Loan details | ~10KB | ~2 loans |
| TanStack Query metadata | ~20KB | Query keys, timestamps |
| **Total** | **~510KB** | |

---

## 6. Native Feel Baseline

### 6.1 App Launch Sequence

Target: **< 300ms** from app foreground to meaningful content visible.

```
App Foregrounded (t=0)
  │
  ├─ [0-5ms] MMKV sync read: auth token exists?
  │   ├─ No  → Show sign-in screen (fast path)
  │   └─ Yes → Continue
  │
  ├─ [5-10ms] MMKV sync read: hydrate Zustand stores
  │   └─ All stores populated from cache synchronously
  │
  ├─ [10-50ms] Render cached UI
  │   ├─ Balance from cache (with staleness badge if > 30s old)
  │   ├─ Last chat messages from cache
  │   └─ Proactive cards from cache (with "from last session" if > 5min old)
  │
  ├─ [50-300ms] Background: validate JWT + refresh if needed
  │
  ├─ [100-500ms] Background: TanStack Query refetches stale queries
  │   ├─ Accounts/balance (if > 30s stale)
  │   ├─ Insights (if > 5min stale)
  │   └─ Results silently update UI (no loading spinners)
  │
  └─ [200-1500ms] If fresh launch: `__app_open__` signal to chat
      └─ Proactive greeting + fresh cards stream in
```

**Key insight:** With MMKV's synchronous reads, there is no "hydration loading state." The app renders cached data on the very first frame after splash screen dismissal. This is the single biggest UX win over AsyncStorage, which requires an async hydration step that either shows a blank screen or requires a loading gate.

### 6.2 Optimistic UI — Conservative Approach

For a banking app, optimistic updates are limited to non-financial operations:

| Action | Optimistic? | Rationale |
|--------|-------------|-----------|
| Send chat message | Yes | Show message in list immediately, stream response |
| Toggle notification preference | Yes | Low risk, revert on failure |
| Create new conversation | Yes | Show empty conversation immediately |
| Transfer money | **No** | Balance must be confirmed server-side |
| Confirm pending action | **No** | Must verify action hasn't expired |
| Edit beneficiary | **No** | Must verify server-side before showing success |

### 6.3 Pull-to-Refresh

All data screens support pull-to-refresh that forces a refetch regardless of staleness:

```typescript
function AccountScreen() {
  const { data, refetch, isRefetching } = useBalance();

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* ... */}
    </ScrollView>
  );
}
```

---

## 7. Agentic Development Context

### 7.1 Chat-Specific Caching Considerations

The chat interface has unique caching requirements because it's the primary interaction surface:

1. **Messages are append-only during streaming.** During an SSE stream, new tokens append to the last message. This is pure Zustand state — not a TanStack Query concern. Only after the stream completes is the full message persisted to Zustand's MMKV-backed store.

2. **Tool call results are embedded in messages.** When the AI calls `get_balance`, the result (a BalanceCard component) is stored in the message's `ui_components` JSONB. This means the chat cache contains *rendered* financial data (balances, transaction amounts, pot goals). This is why the chat MMKV instance uses encryption (Tier 2b) — even though the data is "just what appears on screen," at-rest encryption is required for cached financial values.

3. **Conversation history is authoritative on server.** The local cache holds the last 100 messages. Scrolling further back triggers a paginated fetch from `GET /api/conversations/:id/messages`. This is a TanStack Query concern with `keepPreviousData` for smooth pagination.

4. **The `__app_open__` signal always requires connectivity.** The unified greeting flow (system-architecture.md §6.1) sends a synthetic message to the AI. This cannot work offline. Offline app open shows cached proactive cards with a "from last session" badge instead.

### 7.2 Agent Tool Call Implications

Tool calls are server-side only. The client never caches or replays tool calls. However, the *results* of tool calls appear in the SSE stream and are cached as part of the message:

```
Client sends message → Server runs agent loop → Tool calls execute server-side
                                                        ↓
                                           SSE streams results to client
                                                        ↓
                                           Client appends to Zustand chat store
                                                        ↓
                                           On stream complete: persist to MMKV
```

**Cache invalidation after tool calls:** When a tool call mutates data (e.g., `make_payment`), the domain service returns a `ServiceResult<T>` (see ADR-17) that includes the list of TanStack Query keys to invalidate. The tool handler passes these to the SSE writer:

```typescript
// Domain service returns ServiceResult<T>
type ServiceResult<T> = {
  data: T;
  mutations?: string[];  // TanStack Query keys to invalidate
};

// Server-side: tool handler receives ServiceResult from service call
const serviceResult = await ctx.paymentService.sendPayment(ctx.userId, params);

// Tool handler passes mutations to SSE writer
if (serviceResult.mutations?.length) {
  stream.write(`event: data_changed\ndata: ${JSON.stringify({
    invalidate: serviceResult.mutations  // e.g. ['accounts', 'transactions']
  })}\n\n`);
}

// Client-side: SSE handler
case 'data_changed':
  const { invalidate } = JSON.parse(event.data);
  invalidate.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
  break;
```

This ensures that after "Send £50 to Alice," the balance display updates without the user pulling to refresh.

### 7.3 Multi-Agent Stream Considerations

For the POC, there is one conversation at a time. But the architecture should not prevent future multi-agent scenarios (e.g., a background insight agent running while the user chats). Each agent stream would have its own `conversation_id` and SSE connection. The caching layer handles this naturally — each conversation's messages are stored under a separate key in the chat store.

---

## 8. App Store Requirements

### 8.1 Apple App Store

| Requirement | How We Comply |
|-------------|---------------|
| Financial data must be encrypted at rest | MMKV AES-128-CFB encrypted instances for all financial data (see §2.6 for scope; §14.3 for AES-256 upgrade path) |
| No full card numbers stored on device | PAN never sent to client — masked format only (last 4 digits) |
| Keychain for credentials | SecureStore (wraps iOS Keychain) for JWT tokens |
| Background fetch must not drain battery | `expo-background-task` with minimum 15-minute interval (OS-controlled) |
| Data cleared on app uninstall | MMKV stored in app sandbox — automatically deleted |
| Privacy nutrition labels | Cache contains: financial info (balances), usage data (chat messages) |

### 8.2 Google Play Store

| Requirement | How We Comply |
|-------------|---------------|
| Data Safety section declaration | Financial data cached locally (encrypted), chat history cached locally (encrypted) |
| Encryption at rest for sensitive data | MMKV AES-128-CFB encryption (PCI DSS compliant; AES-256 upgrade path in §14.3) |
| Android Keystore for secrets | SecureStore (wraps Android Keystore) for JWT tokens |
| No sensitive data in app backups | Exclude MMKV directory from Auto Backup via `android:allowBackup="false"` or `backup_rules.xml` |
| Background restrictions compliance | `expo-background-task` uses WorkManager — respects Doze and battery optimization |

### 8.3 UK FCA Considerations

| Requirement | How We Comply |
|-------------|---------------|
| Clear indication when showing stale data | Staleness badges: "Updated {time}" on all cached financial displays |
| Transaction data accuracy | Cache is display-only — all actions validated server-side against live data |
| Data deletion on account closure | Server-initiated wipe + local cache clear on sign-out |

---

## 9. Background Refresh (P1)

### 9.1 expo-background-task

> **Note:** `expo-background-task` replaces the deprecated `expo-background-fetch` as of Expo SDK 53+. Uses BGTaskScheduler on iOS and WorkManager on Android.

Background refresh is P1 — not needed for POC demo. Documented here for architecture completeness.

```typescript
// tasks/background-refresh.ts
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_REFRESH_TASK = 'BACKGROUND_BALANCE_REFRESH';

TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
  try {
    // 1. Check if user is signed in
    const token = await SecureStore.getItemAsync('jwt-access-token');
    if (!token) return BackgroundTask.BackgroundTaskResult.NoData;

    // 2. Fetch latest balance
    const balance = await api.get('/api/accounts/balance', {
      headers: { Authorization: `Bearer ${token}` },
    });

    // 3. Update MMKV cache (so next app open shows fresh data)
    financialStorage.set('latest-balance', JSON.stringify(balance));

    // 4. Update notification badge if balance changed significantly
    // (handled by Knock push notifications, not local badge)

    return BackgroundTask.BackgroundTaskResult.NewData;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Register on app start
BackgroundTask.registerTaskAsync(BACKGROUND_REFRESH_TASK, {
  minimumInterval: 15 * 60, // 15 minutes minimum (OS may delay further)
});
```

**Limitations:** Background tasks are advisory. iOS may delay or skip them entirely based on battery, usage patterns, and Low Power Mode. This is acceptable — background refresh is a polish feature, not a requirement.

---

## 10. Sequencing — Implementation Checklist

### Foundation (F1a — before squad work)

| # | Task | Depends On | Acceptance Criteria |
|---|------|-----------|-------------------|
| F1 | Set up dev builds (`npx expo prebuild`) | — | iOS Simulator and Android Emulator run dev builds |
| F2 | Install and configure `react-native-mmkv` | F1 | Can write/read string from MMKV in a test screen |
| F3 | Implement `lib/storage.ts` (§2.2) | F2 | Two MMKV instances created, encryption key in SecureStore |
| F4 | Migrate Zustand persist from AsyncStorage to MMKV | F3 | V3 validation passes (persist/rehydrate < 200ms) |
| F5 | Install and configure `@tanstack/react-query` + `@tanstack/query-sync-storage-persister` | — | QueryClientProvider wraps app, devtools available |
| F6 | Set up TanStack Query MMKV persister | F3, F5 | Kill app, relaunch, cached query data available instantly |
| F7 | Install and configure `@react-native-community/netinfo` | — | Console logs connectivity changes on airplane mode toggle |
| F8 | Bridge NetInfo → TanStack Query onlineManager (§4.1) | F5, F7 | Queries pause when offline, resume on reconnect |
| F9 | Implement connectivity store (§4.2) | F7 | UI shows connected/reconnecting/offline status |
| F10 | Implement sign-out data wipe (§2.5) | F3 | Sign out, sign in as different user, no stale data visible |

### P0 (During squad work)

| # | Task | Squad | Notes |
|---|------|-------|-------|
| S1 | Migrate account balance to TanStack Query | CB | Replace Zustand fetch + manual lastSyncedAt |
| S2 | Migrate transactions to TanStack Query | CB | Add pagination with keepPreviousData |
| S3 | Migrate pots/beneficiaries to TanStack Query | CB | |
| S4 | Implement `data_changed` SSE handler (§7.2) | EX-Infra | Cache invalidation after tool calls |
| S5 | Add staleness badges to all financial displays | EX-Cards | "Updated {time}" using dataUpdatedAt |
| S6 | Implement offline send-button disable | EX-Infra | Check connectivity store before allowing send |
| S7 | Migrate insights to TanStack Query | EX-Insights | staleTime: 5 minutes |

### P1 (Post-POC)

| # | Task | Notes |
|---|------|-------|
| S8 | Background refresh task (§9) | expo-background-task registration |
| S9 | Offline message drafting | Save to MMKV, send on reconnect |
| S10 | Cache eviction policy | Max 50 transactions per account, max 100 messages |
| S11 | Android backup exclusion | `backup_rules.xml` for MMKV directory |

---

## 11. Open Questions Requiring Product Decisions

| # | Question | Options | Recommendation | Impact if Deferred |
|---|----------|---------|----------------|-------------------|
| ~~Q1~~ | ~~Should we encrypt the chat MMKV instance?~~ | **Resolved:** Yes — chat messages embed financial data via `ui_components` (balances, transactions from tool calls). Chat uses encrypted MMKV instance (Tier 2b). | — | — |
| Q2 | How long should cached data survive without a server sync? | (a) Indefinitely until sign-out, (b) 24h then show "sign in again" | (a) Indefinitely — avoids forced re-auth | Low — staleness badges provide sufficient context |
| Q3 | Should offline users see a full-screen offline banner or inline indicators? | (a) Banner, (b) Inline per-component | (b) Inline — less disruptive, more contextual | None — purely visual decision |
| Q4 | P1: Should background refresh update the app badge with balance? | (a) Yes, (b) No — privacy concern (balance visible on lock screen) | (b) No — UK privacy expectations | None for POC |

---

## 12. Cross-References

| Document | Section | Relationship |
|----------|---------|-------------|
| system-architecture.md | §2.2 Client-Side Data Persistence | **Superseded by** this document §2-4. Offline "Send message" row corrected: disabled (not "message saved") at P0. |
| system-architecture.md | §3.5 Stream Recovery | Unchanged — works independently of caching layer |
| system-architecture.md | §11.4 V3 Validation | V3 technology changes from AsyncStorage to MMKV. Fallback becomes: "Revert to AsyncStorage if MMKV native module causes Expo build issues." Target (< 200ms) unchanged. |
| system-architecture.md | §11.2 Must Add | New foundation files: `lib/storage.ts`, `lib/connectivity.ts`, `lib/query-client.ts`, `stores/connectivity.ts`, `hooks/queries/` |
| tech-decisions.md | ADR-14, ADR-15 | Also documented in tech-decisions.md (the canonical ADR registry). This document contains the expanded specification with §2.6 limitations and §14 security roadmap. |
| notification-system.md | §6 Mobile Integration | Knock feed state stored in `notification` Zustand store (§2.4). See offline-caching-strategy.md for persistence config. |
| data-model.md | §2.21 user_insights_cache | Server-side cache, fetched into TanStack Query client-side |

---

## 13. Summary of Architectural Decisions

| Decision | Choice | Key Trade-off |
|----------|--------|---------------|
| Storage backend | MMKV over AsyncStorage | Requires dev build (no Expo Go), but 30x faster + encrypted |
| Server state management | TanStack Query | Additional dependency, but eliminates manual staleness/retry logic |
| Connectivity detection | NetInfo with custom reachability | Catches captive portals, small overhead |
| Optimistic UI | Conservative (reads only) | Slower perceived writes, but no incorrect financial state |
| Chat encryption | Encrypted MMKV (Tier 2b) | Messages embed financial data via ui_components — encryption required |
| Background refresh | P1 (expo-background-task) | Not needed for POC demo |
| Offline writes | Blocked, not queued | User must retry — balance may have changed |
| On-device encryption | MMKV AES-128-CFB (defense-in-depth) | Not bank-grade — see §2.6 limitations and §14 roadmap |

---

## 14. Security Roadmap — Encryption Maturity

> This section documents the deliberate trade-offs in the POC's on-device encryption and the path to production-grade security. It exists so that security reviewers, auditors, and future engineers understand what was chosen, why, and what comes next.

### 14.1 POC Security Posture (Current)

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS (POC)                     │
│                                                              │
│  Layer 1: OS App Sandbox          ████████████  PRIMARY      │
│  iOS/Android process isolation, file system permissions       │
│                                                              │
│  Layer 2: TLS 1.2+ in Transit    ████████████  PRIMARY      │
│  All API calls over HTTPS, certificate validation            │
│                                                              │
│  Layer 3: Hardware-Backed Secrets ████████████  PRIMARY      │
│  JWT tokens in SecureStore (Keychain / Android Keystore)     │
│                                                              │
│  Layer 4: MMKV AES-128-CFB       ██████░░░░░░  SUPPLEMENTAL │
│  Cached financial data encrypted at rest, 128-bit key        │
│  from hardware-backed SecureStore. Defense-in-depth.         │
│                                                              │
│  Layer 5: Data Minimisation      ████████████  PRIMARY      │
│  No PANs, no CVV, no KYC docs, no API tokens on device     │
│                                                              │
│  ⚠ NOT present in POC:                                      │
│  - Authenticated encryption (no HMAC/GCM)                    │
│  - Certificate pinning                                       │
│  - Jailbreak/root detection                                  │
│  - Key rotation                                              │
│  - Tamper detection                                          │
└─────────────────────────────────────────────────────────────┘
```

### 14.2 Why This Is Defensible for POC

| Concern | Mitigation |
|---------|-----------|
| AES-128 not AES-256 | AES-128 is PCI DSS 4.0 compliant. FCA is principles-based, does not mandate specific algorithms. NIST considers AES-128 secure through 2030+. |
| No integrity/authenticity (CFB mode) | Cached data is display-only. All mutations validated server-side. Tampered cache would show wrong balance but cannot cause money movement. |
| No key derivation | Key is 128 bits of CSPRNG entropy from native platform (not user-derived). No low-entropy risk. |
| Key in SecureStore not hardware-bound | SecureStore uses Keychain (iOS) / Keystore (Android) which ARE hardware-backed on devices with Secure Enclave / TEE. Key extraction requires device root + Keystore bypass. |
| Memory-mapped plaintext while app running | Standard for all mobile apps. Hardware memory encryption (ARMv8.4-A MTE) is OS-level, not app-level. |

### 14.3 Production Roadmap

| Phase | Security Enhancement | Effort | Priority |
|-------|---------------------|--------|----------|
| **MVP** | Pin `react-native-mmkv >= 3.0.0` in package.json | 5 min | **Must** |
| **MVP** | Add `expo-crypto` to dependencies (key generation) | 5 min | **Must** |
| **MVP** | Verify MMKV version in CI (no CVE-2024-21668 regression) | 1 hr | **Must** |
| **Post-POC** | Certificate pinning via `expo-certificate-pinning` or custom TrustManager | 1-2 days | High |
| **Post-POC** | Jailbreak/root detection (e.g., `jail-monkey` or `expo-device` checks) | 1 day | High |
| **Post-POC** | Android backup exclusion (`backup_rules.xml` for MMKV directory) | 2 hrs | High |
| **Pre-Launch** | Migrate financial data storage to SQLCipher (AES-256-CBC + HMAC-SHA512) | 1-2 weeks | High |
| **Pre-Launch** | Keep MMKV (unencrypted) for non-financial key-value only (UI prefs, feature flags) | Included above | High |
| **Pre-Launch** | Biometric-protected SecureStore for encryption keys (`requireAuthentication: true`) | 1 day | Medium |
| **Pre-Launch** | Key rotation mechanism (new key every 90 days, `mmkv.recrypt(newKey)`) | 2-3 days | Medium |
| **Pre-Launch** | Independent security audit / penetration test | 2-4 weeks (external) | **Must** |
| **Post-Launch** | Runtime application self-protection (RASP) | Vendor evaluation | Low |
| **Post-Launch** | Memory encryption for in-process financial data | R&D | Low |

### 14.4 SQLCipher Migration Path (Pre-Launch)

When the product moves from POC to production, the encrypted storage tier should upgrade from MMKV to SQLCipher:

```
POC (Now)                          Production (Pre-Launch)
─────────────                      ────────────────────────
MMKV encrypted "financial"    →    SQLCipher (AES-256-CBC + HMAC-SHA512)
  AES-128-CFB                        via op-sqlite with SQLCipher flag
  No integrity check                 Page-level authenticated encryption
  Key-value only                     Full SQL queries for transactions

MMKV encrypted "chat"         →    SQLCipher (same instance or separate)
  AES-128-CFB                        Messages with ui_components

MMKV unencrypted "app"        →    MMKV unencrypted (no change)
  UI prefs, feature flags            Non-sensitive, no upgrade needed
```

**Why not SQLCipher now?**
- Adds `op-sqlite` native dependency + SQLCipher compilation (C cross-compilation for iOS/Android)
- Requires schema design for financial data (accounts, transactions, messages tables)
- Adds 2-3 days of Foundation work for a POC that won't store real user data
- MMKV AES-128 is sufficient for demo data behind OS sandboxing + hardware-backed keys

**Why SQLCipher for production?**
- AES-256-CBC with HMAC-SHA512 page authentication — true authenticated encryption
- Battle-tested: used by Signal, WhatsApp, and thousands of commercial banking apps
- ~5-15% overhead vs unencrypted SQLite — negligible
- SQL queries enable efficient transaction search/filtering without loading all data into memory
- Independent security audits available (Zetetic publishes audit reports)

### 14.5 Agentic Code Risk Mitigations

> AI coding assistants are statistically more likely to produce insecure cryptographic code (Stanford, 2022). This section documents specific guardrails for agentic development of the encryption layer.

| Risk | Mitigation |
|------|-----------|
| AI generates `crypto.getRandomValues()` | **Will crash in Hermes.** CI lint rule: ban `crypto.getRandomValues` import. Use `expo-crypto.getRandomBytesAsync()` exclusively. |
| AI generates 32-byte key for MMKV | **Silently truncated to 16 bytes**, wasting entropy and creating false confidence. CI lint rule: key generation must produce exactly 16 bytes. |
| AI hardcodes encryption keys in source | CI secret scanning (e.g., `gitleaks`) must be configured before Foundation. |
| AI suggests `AES-256` for MMKV | **MMKV uses AES-128 regardless of key length.** Code review checklist item: verify encryption claims match library reality. |
| AI adds custom HMAC layer on top of MMKV | Over-engineering for POC. If integrity is needed, migrate to SQLCipher (§14.4), don't bolt custom crypto onto MMKV. |
| AI uses `Math.random()` for key generation | **Not cryptographically secure.** CI lint rule: ban `Math.random` in any file under `lib/storage*` or `*crypto*`. |
| AI stores encryption key in AsyncStorage | **Unencrypted plaintext.** CI lint rule: encryption keys must use `SecureStore` exclusively. |

**Foundation checklist addition:**

| # | Task | Acceptance Criteria |
|---|------|-------------------|
| F11 | Configure CI lint rules for crypto guardrails | `crypto.getRandomValues`, `Math.random` in storage files, and hardcoded key patterns flagged as errors |
| F12 | Verify `react-native-mmkv` version >= 3.0.0 | `package.json` has `"react-native-mmkv": "^3.0.0"` with no lower override |

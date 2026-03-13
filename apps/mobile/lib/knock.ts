/**
 * Lightweight Knock REST client.
 *
 * @knocklabs/react-native and @knocklabs/client are NOT in package.json, so we
 * talk to the Knock Management API directly. Notifications are non-critical —
 * every method swallows errors and returns a safe fallback value.
 *
 * Docs: https://docs.knock.app/reference
 */

const KNOCK_API_BASE = 'https://api.knock.app';
const KNOCK_PUBLIC_API_KEY = process.env.EXPO_PUBLIC_KNOCK_PUBLIC_API_KEY ?? '';
export const KNOCK_EXPO_CHANNEL_ID = process.env.EXPO_PUBLIC_KNOCK_EXPO_CHANNEL_ID ?? '';
export const KNOCK_FEED_CHANNEL_ID = process.env.EXPO_PUBLIC_KNOCK_FEED_CHANNEL_ID ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnockFeedItem {
  id: string;
  inserted_at: string;
  read_at: string | null;
  seen_at: string | null;
  blocks: Array<{ type: string; rendered: string; name?: string }>;
}

export interface KnockFeedResponse {
  entries: KnockFeedItem[];
  meta: {
    unread_count: number;
    unseen_count: number;
    total_count: number;
  };
  page_info: {
    before: string | null;
    after: string | null;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function authHeader(): string {
  return `Bearer ${KNOCK_PUBLIC_API_KEY}`;
}

async function knockFetch<T>(
  path: string,
  options: RequestInit = {},
  fallback: T,
): Promise<T> {
  if (!KNOCK_PUBLIC_API_KEY) {
    return fallback;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(`${KNOCK_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return fallback;
    }
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// User identity
// ---------------------------------------------------------------------------

/**
 * Identify (upsert) the user in Knock so feed + notifications work.
 * Should be called once after sign-in.
 */
export async function knockIdentify(userId: string, name?: string): Promise<void> {
  await knockFetch(
    `/v1/users/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ name: name ?? userId }),
    },
    undefined,
  );
}

/**
 * Register an Expo push token for a user on the given channel.
 * Token is the raw Expo push token string (ExponentPushToken[…]).
 */
export async function registerPushToken(userId: string, token: string): Promise<void> {
  if (!KNOCK_EXPO_CHANNEL_ID || !token) return;
  await knockFetch(
    `/v1/users/${encodeURIComponent(userId)}/channel_data/${encodeURIComponent(KNOCK_EXPO_CHANNEL_ID)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ data: { tokens: [token] } }),
    },
    undefined,
  );
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

const EMPTY_FEED: KnockFeedResponse = {
  entries: [],
  meta: { unread_count: 0, unseen_count: 0, total_count: 0 },
  page_info: { before: null, after: null },
};

/**
 * Fetch the in-app feed for a user.
 */
export async function getFeed(
  userId: string,
  options: { pageSize?: number; after?: string } = {},
): Promise<KnockFeedResponse> {
  if (!KNOCK_FEED_CHANNEL_ID) return EMPTY_FEED;
  const params = new URLSearchParams();
  params.set('page_size', String(options.pageSize ?? 20));
  if (options.after) params.set('after', options.after);

  return knockFetch<KnockFeedResponse>(
    `/v1/users/${encodeURIComponent(userId)}/feeds/${encodeURIComponent(KNOCK_FEED_CHANNEL_ID)}?${params}`,
    {},
    EMPTY_FEED,
  );
}

/**
 * Mark a single feed item as read.
 */
export async function markAsRead(userId: string, itemId: string): Promise<void> {
  if (!KNOCK_FEED_CHANNEL_ID) return;
  await knockFetch(
    `/v1/users/${encodeURIComponent(userId)}/feeds/${encodeURIComponent(KNOCK_FEED_CHANNEL_ID)}/messages/${encodeURIComponent(itemId)}/read`,
    { method: 'PUT' },
    undefined,
  );
}

/**
 * Mark all feed items as seen (clears the unseen badge).
 */
export async function markAllSeen(userId: string): Promise<void> {
  if (!KNOCK_FEED_CHANNEL_ID) return;
  await knockFetch(
    `/v1/users/${encodeURIComponent(userId)}/feeds/${encodeURIComponent(KNOCK_FEED_CHANNEL_ID)}/seen`,
    { method: 'POST' },
    undefined,
  );
}

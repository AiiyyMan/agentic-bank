/**
 * NotificationBell
 *
 * Bell icon with an unread-count badge. Tapping opens a modal bottom-sheet
 * that renders the Knock in-app notification feed.
 *
 * - Uses the Phosphor `Bell` icon (already in package.json).
 * - Fetches feed via the lightweight Knock REST client (lib/knock.ts).
 * - Marks items as read on tap; marks all as seen when the sheet opens.
 * - Fully graceful: if Knock env vars are absent the component renders as a
 *   plain bell with no badge and an empty feed.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItemInfo,
} from 'react-native';
import { Bell, X } from 'phosphor-react-native';
import { useAuthStore } from '../stores/auth';
import { getFeed, markAsRead, markAllSeen } from '../lib/knock';
import type { KnockFeedItem } from '../lib/knock';
import { useTokens } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function extractTitle(item: KnockFeedItem): string {
  // Look for a "body" block first, then fall back to any rendered text.
  const body = item.blocks.find((b) => b.name === 'body' || b.type === 'markdown');
  if (body?.rendered) {
    // Strip basic HTML tags from rendered Markdown.
    return body.rendered.replace(/<[^>]+>/g, '').trim().slice(0, 120);
  }
  const first = item.blocks[0];
  if (first?.rendered) {
    return first.rendered.replace(/<[^>]+>/g, '').trim().slice(0, 120);
  }
  return 'New notification';
}

// ---------------------------------------------------------------------------
// Feed item row
// ---------------------------------------------------------------------------

interface FeedItemRowProps {
  item: KnockFeedItem;
  onPress: (item: KnockFeedItem) => void;
}

function FeedItemRow({ item, onPress }: FeedItemRowProps) {
  const t = useTokens();
  const isUnread = item.read_at === null;

  return (
    <TouchableOpacity
      style={[
        styles.feedItem,
        {
          backgroundColor: isUnread ? t.brand.subtle : t.surface.default,
          borderBottomColor: t.border.default,
        },
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {isUnread && (
        <View style={[styles.unreadDot, { backgroundColor: t.brand.default }]} />
      )}
      <View style={styles.feedItemContent}>
        <Text
          style={[
            styles.feedItemTitle,
            { color: isUnread ? t.text.primary : t.text.secondary },
          ]}
          numberOfLines={3}
        >
          {extractTitle(item)}
        </Text>
        <Text style={[styles.feedItemTime, { color: t.text.tertiary }]}>
          {formatRelativeTime(item.inserted_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const t = useTokens();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id ?? null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KnockFeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Poll unread count every 30 s while app is active.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function pollUnread() {
      if (!userId || cancelled) return;
      const feed = await getFeed(userId, { pageSize: 1 });
      if (!cancelled) setUnreadCount(feed.meta.unread_count);
    }

    pollUnread();
    const interval = setInterval(pollUnread, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  const openFeed = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    if (userId) {
      const [feed] = await Promise.all([
        getFeed(userId),
        markAllSeen(userId),
      ]);
      setItems(feed.entries);
      setUnreadCount(feed.meta.unread_count);
    }
    setLoading(false);
  }, [userId]);

  const handleItemPress = useCallback(
    async (item: KnockFeedItem) => {
      if (!userId || item.read_at !== null) return;
      // Optimistic update
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markAsRead(userId, item.id);
    },
    [userId],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<KnockFeedItem>) => (
      <FeedItemRow item={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  const keyExtractor = useCallback((item: KnockFeedItem) => item.id, []);

  return (
    <>
      {/* Bell trigger */}
      <TouchableOpacity
        style={styles.bellButton}
        onPress={openFeed}
        accessibilityLabel={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        accessibilityRole="button"
      >
        <Bell size={22} color={t.text.primary} weight="regular" />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: t.status.error.default }]}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Feed modal */}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView
          style={[styles.modalContainer, { backgroundColor: t.background.primary }]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: t.border.default }]}>
            <Text style={[styles.modalTitle, { color: t.text.primary }]}>
              Notifications
            </Text>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              accessibilityLabel="Close notifications"
              accessibilityRole="button"
            >
              <X size={22} color={t.text.secondary} weight="regular" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centred}>
              <ActivityIndicator color={t.brand.default} />
            </View>
          ) : (
            <FlatList<KnockFeedItem>
              data={items}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
              ListEmptyComponent={
                <View style={styles.centred}>
                  <Bell size={40} color={t.text.disabled} weight="regular" />
                  <Text style={[styles.emptyText, { color: t.text.tertiary }]}>
                    No notifications yet
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  bellButton: {
    padding: 8,
    marginRight: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },

  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },

  feedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  feedItemContent: {
    flex: 1,
    gap: 4,
  },
  feedItemTitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  feedItemTime: {
    fontSize: 12,
  },

  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyText: {
    fontSize: 15,
  },
});

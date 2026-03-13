import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#2d2d44',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function BalanceCardSkeleton() {
  return (
    <View style={{ margin: 16, padding: 20, backgroundColor: '#1a1a2e', borderRadius: 16, borderWidth: 1, borderColor: '#2d2d44' }}>
      <Skeleton width={100} height={12} style={{ marginBottom: 10 }} />
      <Skeleton width={180} height={40} style={{ marginBottom: 8 }} />
      <Skeleton width={140} height={12} />
    </View>
  );
}

export function TransactionRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
      <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width={120} height={14} style={{ marginBottom: 6 }} />
        <Skeleton width={80} height={11} />
      </View>
      <Skeleton width={60} height={14} />
    </View>
  );
}

export function PotCardSkeleton() {
  return (
    <View style={{ width: 140, padding: 14, backgroundColor: '#1a1a2e', borderRadius: 14, borderWidth: 1, borderColor: '#2d2d44', marginRight: 10 }}>
      <Skeleton width={32} height={32} borderRadius={16} style={{ marginBottom: 10 }} />
      <Skeleton width={90} height={12} style={{ marginBottom: 8 }} />
      <Skeleton width={70} height={18} style={{ marginBottom: 8 }} />
      <Skeleton width="100%" height={4} borderRadius={2} />
    </View>
  );
}

export function ChatMessageSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Skeleton width={28} height={28} borderRadius={14} />
        <View>
          <Skeleton width={200} height={14} borderRadius={12} style={{ marginBottom: 6 }} />
          <Skeleton width={150} height={14} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Balance card skeleton */}
      <View style={styles.balanceCard}>
        <Skeleton width={120} height={14} style={{ marginBottom: 12 }} />
        <Skeleton width={200} height={36} style={{ marginBottom: 8 }} />
        <Skeleton width={160} height={12} />
      </View>

      {/* Quick actions skeleton */}
      <View style={styles.quickActions}>
        <Skeleton width={100} height={80} borderRadius={12} />
        <Skeleton width={100} height={80} borderRadius={12} />
        <Skeleton width={100} height={80} borderRadius={12} />
      </View>

      {/* Transactions skeleton */}
      <View style={styles.section}>
        <Skeleton width={140} height={14} style={{ marginBottom: 16 }} />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} width="100%" height={56} borderRadius={8} style={{ marginBottom: 8 }} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  balanceCard: {
    padding: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    marginBottom: 24,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  section: { marginBottom: 24 },
});

import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonCardProps {
  lines?: number;
  showHeader?: boolean;
}

function SkeletonLine({ width = '100%' as string | `${number}%` }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[animatedStyle, { width, height: 12, borderRadius: 999, backgroundColor: '#E2E8F0', marginBottom: 8 }]}
    />
  );
}

export function SkeletonCard({ lines = 3, showHeader = true }: SkeletonCardProps) {
  return (
    <View className="bg-surface-raised border border-border-default rounded-2xl p-4 my-2 mx-1">
      {showHeader && (
        <View className="flex-row items-center mb-3 gap-3">
          <SkeletonLine width="8%" />
          <SkeletonLine width="60%" />
        </View>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

/**
 * Three-dot typing indicator using Animated (no Reanimated dependency).
 * Each dot pulses opacity with a staggered delay.
 */
export function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );

    const a1 = makePulse(dot1, 0);
    const a2 = makePulse(dot2, 200);
    const a3 = makePulse(dot3, 400);

    a1.start();
    a2.start();
    a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View className="px-4 py-1 items-start">
      <View className="bg-surface-raised border border-border-default rounded-2xl rounded-tl-sm px-4 py-3.5 flex-row items-center gap-1.5">
        {[dot1, dot2, dot3].map((anim, i) => (
          <Animated.View
            key={i}
            style={{ opacity: anim }}
            className="w-2 h-2 rounded-full bg-text-tertiary"
          />
        ))}
      </View>
    </View>
  );
}

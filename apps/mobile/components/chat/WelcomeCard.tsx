import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';

interface WelcomeCardProps {
  onAction?: (message: string) => void;
  onSignIn?: () => void;
  onTellMeMore?: () => void;
}

const VALUE_PROPS = [
  { label: 'Open your account in 2 minutes', action: 'Open your account in 2 minutes' },
  { label: 'AI that suggests, you decide', action: 'AI that suggests, you decide' },
  { label: 'FSCS protected up to £85,000', action: 'FSCS protected up to £85,000' },
  { label: 'FCA regulated', action: 'FCA regulated' },
];

export function WelcomeCard({ onAction, onSignIn, onTellMeMore }: WelcomeCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <View className="bg-brand-subtle border border-brand-muted rounded-2xl p-6 my-2 mx-1">
        {/* Logo */}
        <View className="items-center mb-5">
          <View className="w-14 h-14 rounded-full bg-brand-default items-center justify-center mb-3">
            <Text className="text-white text-xl font-bold">AB</Text>
          </View>
          <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-widest">
            Agentic Bank
          </Text>
        </View>

        {/* Headline */}
        <Text className="text-text-primary text-2xl font-bold text-center mb-2 leading-8">
          Meet your AI personal banker.
        </Text>
        <Text className="text-text-secondary text-sm text-center mb-6 leading-5">
          Banking built around you, powered by AI.
        </Text>

        {/* Value prop bullets */}
        <View className="gap-2 mb-6">
          {VALUE_PROPS.map((vp) => (
            <TouchableOpacity
              key={vp.action}
              onPress={() => onAction?.(vp.action)}
              className="flex-row items-center gap-3 bg-surface-raised rounded-xl px-4 py-3 active:opacity-70"
              disabled={!onAction}
            >
              <Text className="text-brand-default text-base leading-none">&#8226;</Text>
              <Text className="text-text-primary text-sm flex-1">{vp.label}</Text>
              {onAction && (
                <Text className="text-brand-default text-sm">&#8250;</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          onPress={() => onAction?.("Let's open your account")}
          className="bg-brand-default rounded-xl py-3.5 items-center mb-4 active:opacity-80"
          disabled={!onAction}
        >
          <Text className="text-white text-sm font-semibold">
            Let&apos;s open your account
          </Text>
        </TouchableOpacity>

        {/* Secondary links */}
        <View className="items-center gap-3">
          <TouchableOpacity
            onPress={() => {
              if (onTellMeMore) {
                onTellMeMore();
              } else {
                onAction?.('Tell me more');
              }
            }}
          >
            <Text className="text-brand-default text-sm font-medium">
              Tell me more
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSignIn}>
            <Text className="text-text-tertiary text-xs">
              Already have an account?{' '}
              <Text className="text-brand-default font-medium">Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

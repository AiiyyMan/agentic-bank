import { View, Text } from 'react-native';

type QuoteCategory = 'tip' | 'definition' | 'warning' | 'info';

interface QuoteCardProps {
  quote: string;
  source?: string;
  category?: QuoteCategory;
}

// Maps category to NativeWind class tokens for border accent, badge bg, and badge text
const CATEGORY_CLASSES: Record<QuoteCategory, { border: string; badgeBg: string; badgeText: string; label: string }> = {
  tip:        { border: 'border-l-status-success',  badgeBg: 'bg-status-success-subtle', badgeText: 'text-status-success-text', label: 'Tip' },
  definition: { border: 'border-l-brand-default',   badgeBg: 'bg-brand-subtle',          badgeText: 'text-brand-text',          label: 'Definition' },
  warning:    { border: 'border-l-status-warning',  badgeBg: 'bg-status-warning-subtle', badgeText: 'text-status-warning-text', label: 'Warning' },
  info:       { border: 'border-l-status-info',     badgeBg: 'bg-status-info-subtle',    badgeText: 'text-status-info-text',    label: 'Info' },
};

export function QuoteCard({ quote, source, category = 'info' }: QuoteCardProps) {
  const cfg = CATEGORY_CLASSES[category];

  return (
    <View
      className={`bg-surface-primary border border-border-primary rounded-xl rounded-tl-sm rounded-bl-sm p-4 my-2 mx-1 border-l-4 ${cfg.border}`}
    >
      {/* Category badge */}
      <View className={`self-start px-2.5 py-0.5 rounded-full mb-2.5 ${cfg.badgeBg}`}>
        <Text className={`text-xs font-semibold uppercase tracking-wide ${cfg.badgeText}`}>{cfg.label}</Text>
      </View>

      {/* Quote text */}
      <Text className="text-text-primary text-sm italic leading-5 mb-2">"{quote}"</Text>

      {/* Source attribution */}
      {source ? (
        <Text className="text-text-tertiary text-xs text-right">— {source}</Text>
      ) : null}
    </View>
  );
}

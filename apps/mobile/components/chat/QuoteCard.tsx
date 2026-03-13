import { View, Text, StyleSheet } from 'react-native';

type QuoteCategory = 'tip' | 'definition' | 'warning' | 'info';

interface QuoteCardProps {
  quote: string;
  source?: string;
  category?: QuoteCategory;
}

const CATEGORY_CONFIG: Record<QuoteCategory, { color: string; label: string; bg: string }> = {
  tip: { color: '#2ecc71', label: 'Tip', bg: 'rgba(46, 204, 113, 0.12)' },
  definition: { color: '#6c5ce7', label: 'Definition', bg: 'rgba(108, 92, 231, 0.12)' },
  warning: { color: '#f39c12', label: 'Warning', bg: 'rgba(243, 156, 18, 0.12)' },
  info: { color: '#3498db', label: 'Info', bg: 'rgba(52, 152, 219, 0.12)' },
};

export function QuoteCard({ quote, source, category = 'info' }: QuoteCardProps) {
  const config = CATEGORY_CONFIG[category];

  return (
    <View style={[styles.card, { borderLeftColor: config.color }]}>
      {/* Category badge */}
      <View style={[styles.badge, { backgroundColor: config.bg }]}>
        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
      </View>

      {/* Quote text */}
      <Text style={styles.quoteText}>"{quote}"</Text>

      {/* Source attribution */}
      {source ? (
        <Text style={styles.sourceText}>— {source}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  badge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quoteText: {
    color: '#e0e0f0',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 8,
  },
  sourceText: {
    color: '#5a5a72',
    fontSize: 12,
    textAlign: 'right',
    fontStyle: 'normal',
  },
});

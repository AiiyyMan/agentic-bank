import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface AutoSaveRuleCardProps {
  ruleName: string;
  description: string;
  targetPot?: string;
  isActive: boolean;
  savedThisMonth?: number;
  onToggle?: () => void;
}

export function AutoSaveRuleCard({
  ruleName,
  description,
  targetPot,
  isActive,
  savedThisMonth,
  onToggle,
}: AutoSaveRuleCardProps) {
  const formattedSaved =
    savedThisMonth !== undefined
      ? `£${savedThisMonth.toFixed(2)}`
      : null;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.ruleName}>{ruleName}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        {/* Toggle */}
        <TouchableOpacity
          style={[styles.toggle, isActive ? styles.toggleActive : styles.toggleInactive]}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <View style={[styles.toggleThumb, isActive ? styles.thumbActive : styles.thumbInactive]} />
        </TouchableOpacity>
      </View>

      {/* Meta row */}
      <View style={styles.metaRow}>
        {targetPot ? (
          <View style={styles.potChip}>
            <Text style={styles.potChipText}>→ {targetPot}</Text>
          </View>
        ) : null}

        {formattedSaved ? (
          <View style={styles.savedChip}>
            <Text style={styles.savedLabel}>This month</Text>
            <Text style={styles.savedAmount}>{formattedSaved}</Text>
          </View>
        ) : null}
      </View>

      {/* Status badge */}
      <View style={[styles.statusBadge, isActive ? styles.badgeActive : styles.badgeInactive]}>
        <View style={[styles.statusDot, isActive ? styles.dotActive : styles.dotInactive]} />
        <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
          {isActive ? 'Active' : 'Paused'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  ruleName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: '#8b8ba7',
    fontSize: 13,
    lineHeight: 18,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 3,
    marginTop: 2,
  },
  toggleActive: {
    backgroundColor: '#6c5ce7',
  },
  toggleInactive: {
    backgroundColor: '#2d2d44',
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  thumbActive: {
    alignSelf: 'flex-end',
  },
  thumbInactive: {
    alignSelf: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  potChip: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  potChipText: {
    color: '#a29bfe',
    fontSize: 12,
    fontWeight: '500',
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e35',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  savedLabel: {
    color: '#8b8ba7',
    fontSize: 12,
  },
  savedAmount: {
    color: '#2ecc71',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeActive: {
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
  },
  badgeInactive: {
    backgroundColor: 'rgba(139, 139, 167, 0.12)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#2ecc71',
  },
  dotInactive: {
    backgroundColor: '#5a5a72',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextActive: {
    color: '#2ecc71',
  },
  statusTextInactive: {
    color: '#5a5a72',
  },
});

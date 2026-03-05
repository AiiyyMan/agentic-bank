import { View, Text, StyleSheet } from 'react-native';

interface LoanStatusCardProps {
  principal: string;
  remaining: string;
  rate: string;
  monthlyPayment: string;
  nextDate: string;
  status: string;
}

export function LoanStatusCard({
  principal,
  remaining,
  rate,
  monthlyPayment,
  nextDate,
  status,
}: LoanStatusCardProps) {
  const principalNum = parseFloat(principal);
  const progress = principalNum > 0 ? 1 - parseFloat(remaining) / principalNum : 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Active Loan</Text>
        <Text style={[styles.badge, status === 'active' && styles.activeBadge]}>
          {status}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${Math.max(progress * 100, 2)}%` }]} />
      </View>
      <Text style={styles.progressText}>
        £{parseFloat(remaining).toFixed(2)} remaining of £{parseFloat(principal).toFixed(2)}
      </Text>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={styles.detailKey}>Monthly Payment</Text>
          <Text style={styles.detailValue}>£{parseFloat(monthlyPayment).toFixed(2)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailKey}>Interest Rate</Text>
          <Text style={styles.detailValue}>{rate}% APR</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailKey}>Next Payment</Text>
          <Text style={styles.detailValue}>{nextDate}</Text>
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#8b8ba7', fontSize: 13, fontWeight: '500', textTransform: 'uppercase' },
  badge: {
    color: '#8b8ba7',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  activeBadge: { color: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.15)' },
  progressContainer: {
    height: 6,
    backgroundColor: '#2d2d44',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#6c5ce7',
    borderRadius: 3,
  },
  progressText: { color: '#8b8ba7', fontSize: 12, marginBottom: 12 },
  details: {},
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailKey: { color: '#8b8ba7', fontSize: 14 },
  detailValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
});

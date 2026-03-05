import { View, Text, StyleSheet } from 'react-native';

interface LoanOfferCardProps {
  amount: string;
  rate: string;
  term: number;
  monthlyPayment: string;
}

export function LoanOfferCard({ amount, rate, term, monthlyPayment }: LoanOfferCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Loan Offer</Text>

      <View style={styles.amountRow}>
        <Text style={styles.amount}>£{parseFloat(amount).toLocaleString()}</Text>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>APR</Text>
          <Text style={styles.detailValue}>{rate}%</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Term</Text>
          <Text style={styles.detailValue}>{term} months</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Monthly</Text>
          <Text style={styles.detailValue}>£{parseFloat(monthlyPayment).toFixed(2)}</Text>
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
    borderColor: '#2ecc71',
  },
  title: {
    color: '#2ecc71',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  amountRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  amount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailItem: { alignItems: 'center' },
  detailLabel: { color: '#8b8ba7', fontSize: 12, marginBottom: 4 },
  detailValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

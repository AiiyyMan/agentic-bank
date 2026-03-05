import { View, Text, StyleSheet, FlatList } from 'react-native';

interface Transaction {
  amount: string;
  currency?: string;
  direction: 'credit' | 'debit';
  type?: string;
  description?: string;
  date: string;
  balance_after?: string;
}

interface TransactionListCardProps {
  transactions: Transaction[];
}

export function TransactionListCard({ transactions }: TransactionListCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatAmount = (amount: string, direction: string) => {
    const prefix = direction === 'credit' ? '+' : '-';
    return `${prefix}£${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Recent Transactions</Text>
      {transactions.map((tx, index) => (
        <View key={index} style={[styles.row, index < transactions.length - 1 && styles.rowBorder]}>
          <View style={styles.left}>
            <Text style={styles.type}>
              {tx.description || tx.type || 'Transaction'}
            </Text>
            <Text style={styles.date}>{formatDate(tx.date)}</Text>
          </View>
          <Text style={[styles.amount, tx.direction === 'credit' ? styles.credit : styles.debit]}>
            {formatAmount(tx.amount, tx.direction)}
          </Text>
        </View>
      ))}
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
  title: {
    color: '#8b8ba7',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  left: { flex: 1 },
  type: { color: '#fff', fontSize: 15, fontWeight: '500' },
  date: { color: '#8b8ba7', fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '600' },
  credit: { color: '#2ecc71' },
  debit: { color: '#e74c3c' },
});

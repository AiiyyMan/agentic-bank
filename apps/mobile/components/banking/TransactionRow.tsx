import { View, Text, StyleSheet } from 'react-native';

interface TransactionRowProps {
  amount: string;
  currency: string;
  direction: 'credit' | 'debit';
  type: string;
  date: string;
  primary_category?: string;
}

export function TransactionRow({ amount, direction, type, date }: TransactionRowProps) {
  const isCredit = direction === 'credit';
  const formattedTime = new Date(date).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const formattedAmount = `${isCredit ? '+' : '-'}£${Math.abs(parseFloat(amount)).toFixed(2)}`;

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, isCredit ? styles.iconCredit : styles.iconDebit]}>
        <Text style={[styles.icon, isCredit ? styles.iconTextCredit : styles.iconTextDebit]}>
          {isCredit ? '↓' : '↑'}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.merchantName}>{type}</Text>
        <Text style={styles.time}>{formattedTime}</Text>
      </View>
      <Text style={[styles.amount, isCredit ? styles.amountCredit : styles.amountDebit]}>
        {formattedAmount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
    marginBottom: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCredit: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
  },
  iconDebit: {
    backgroundColor: '#2d2d44',
  },
  icon: {
    fontSize: 16,
    fontWeight: '700',
  },
  iconTextCredit: {
    color: '#2ecc71',
  },
  iconTextDebit: {
    color: '#8b8ba7',
  },
  info: {
    flex: 1,
  },
  merchantName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  time: {
    color: '#555',
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
  },
  amountCredit: {
    color: '#2ecc71',
  },
  amountDebit: {
    color: '#e74c3c',
  },
});

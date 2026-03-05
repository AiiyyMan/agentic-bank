import { View, Text, StyleSheet } from 'react-native';

interface BalanceCardProps {
  balance: string;
  currency: string;
  accountName: string;
  accountNumber?: string;
}

export function BalanceCard({ balance, currency, accountName, accountNumber }: BalanceCardProps) {
  const formattedBalance = `£${parseFloat(balance).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Available Balance</Text>
      <Text style={styles.balance}>{formattedBalance}</Text>
      <View style={styles.details}>
        <Text style={styles.accountName}>{accountName}</Text>
        {accountNumber && (
          <Text style={styles.accountNumber}>{accountNumber}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#6c5ce7',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 4,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  balance: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accountName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  accountNumber: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
});

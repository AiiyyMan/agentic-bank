import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { sendChatMessage, getLoans } from '../../lib/api';
import { DashboardSkeleton } from '../../components/Skeleton';

interface BalanceData {
  balance: string;
  currency: string;
  account_name?: string;
  account_number?: string;
}

interface Transaction {
  amount: string;
  currency: string;
  direction: string;
  type: string;
  date: string;
}

interface LoanSummary {
  id: string;
  principal: number;
  remaining: number;
  monthly_payment: number;
  status: string;
}

export default function DashboardScreen() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');

      // Fetch balance via agent (check_balance tool)
      const [balanceRes, loansRes] = await Promise.allSettled([
        sendChatMessage({ message: 'What is my balance?' }),
        getLoans(),
      ]);

      // Parse balance from agent response UI components
      if (balanceRes.status === 'fulfilled' && balanceRes.value.ui_components) {
        const balanceCard = balanceRes.value.ui_components.find(
          (c: any) => c.type === 'balance_card'
        );
        if (balanceCard) {
          setBalance(balanceCard.data as BalanceData);
        }

        // Also extract transactions if available
        const txCard = balanceRes.value.ui_components.find(
          (c: any) => c.type === 'transaction_list'
        );
        if (txCard && (txCard.data as any).transactions) {
          setTransactions((txCard.data as any).transactions.slice(0, 5));
        }
      }

      // Parse loans
      if (loansRes.status === 'fulfilled' && loansRes.value.loans) {
        setLoans(loansRes.value.loans);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>
          {balance ? `£${parseFloat(balance.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}
        </Text>
        {balance?.account_name && (
          <Text style={styles.accountInfo}>{balance.account_name}</Text>
        )}
        {balance?.account_number && (
          <Text style={styles.accountNumber}>{balance.account_number}</Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/chat')}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>Ask Agent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/transactions')}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionLabel}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/chat')}
        >
          <Text style={styles.actionIcon}>💸</Text>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Active Loans */}
      {loans.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Loans</Text>
          {loans.map((loan) => (
            <View key={loan.id} style={styles.loanCard}>
              <View style={styles.loanHeader}>
                <Text style={styles.loanAmount}>£{loan.principal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
                <Text style={styles.loanStatus}>{loan.status}</Text>
              </View>
              <View style={styles.loanDetails}>
                <Text style={styles.loanDetail}>Remaining: £{loan.remaining.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
                <Text style={styles.loanDetail}>Monthly: £{loan.monthly_payment.toFixed(2)}</Text>
              </View>
              {/* Progress bar */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, ((loan.principal - loan.remaining) / loan.principal) * 100))}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {transactions.map((tx, index) => (
            <View key={index} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txType}>{tx.type}</Text>
                <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString('en-GB')}</Text>
              </View>
              <Text style={[styles.txAmount, tx.direction === 'credit' ? styles.credit : styles.debit]}>
                {tx.direction === 'credit' ? '+' : '-'}£{Math.abs(parseFloat(tx.amount)).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA to chat */}
      <TouchableOpacity
        style={styles.chatCta}
        onPress={() => router.push('/(tabs)/chat')}
      >
        <Text style={styles.chatCtaText}>Need help? Chat with your banking assistant</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b8ba7', marginTop: 12, fontSize: 14 },

  errorBanner: {
    backgroundColor: '#2d1b1b',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: '#e74c3c', fontSize: 13, flex: 1 },
  retryText: { color: '#6c5ce7', fontWeight: '600', marginLeft: 12 },

  balanceCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  balanceLabel: { color: '#8b8ba7', fontSize: 14, marginBottom: 8 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '700' },
  accountInfo: { color: '#8b8ba7', fontSize: 13, marginTop: 8 },
  accountNumber: { color: '#555', fontSize: 12, marginTop: 4 },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    width: 100,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  actionIcon: { fontSize: 24, marginBottom: 8 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '500' },

  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#8b8ba7', fontSize: 14, fontWeight: '500', textTransform: 'uppercase', marginBottom: 12 },
  seeAll: { color: '#6c5ce7', fontSize: 13, fontWeight: '500' },

  loanCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    marginBottom: 8,
  },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  loanAmount: { color: '#fff', fontSize: 18, fontWeight: '600' },
  loanStatus: { color: '#2ecc71', fontSize: 13, fontWeight: '500', textTransform: 'uppercase' },
  loanDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  loanDetail: { color: '#8b8ba7', fontSize: 13 },
  progressBar: {
    height: 4,
    backgroundColor: '#2d2d44',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6c5ce7',
    borderRadius: 2,
  },

  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
    marginBottom: 6,
  },
  txLeft: {},
  txType: { color: '#fff', fontSize: 14 },
  txDate: { color: '#555', fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '600' },
  credit: { color: '#2ecc71' },
  debit: { color: '#e74c3c' },

  chatCta: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    alignItems: 'center',
  },
  chatCtaText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});

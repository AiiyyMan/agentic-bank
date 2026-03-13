import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getBalance as fetchBalance, getTransactions as fetchTransactions, getLoans, getPots, getProactiveCards } from '../../lib/api';
import { DashboardSkeleton } from '../../components/Skeleton';
import { InsightCard } from '../../components/chat/InsightCard';
import { useTokens } from '../../theme/tokens';

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

interface Pot {
  id: string;
  name: string;
  balance: number;
  goal_amount: number | null;
  emoji: string | null;
  progress_percent: number | null;
}

interface InsightItem {
  title: string;
  message: string;
  category?: string;
  change_percent?: number;
  period?: string;
}

export default function DashboardScreen() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const t = useTokens();

  const fetchData = useCallback(async () => {
    try {
      setError('');

      const [balanceRes, txRes, loansRes, potsRes, insightsRes] = await Promise.allSettled([
        fetchBalance(),
        fetchTransactions(5),
        getLoans(),
        getPots(),
        getProactiveCards(),
      ]);

      if (balanceRes.status === 'fulfilled') {
        setBalance(balanceRes.value as BalanceData);
      }

      if (txRes.status === 'fulfilled' && txRes.value.transactions) {
        setTransactions(txRes.value.transactions.slice(0, 5));
      }

      if (loansRes.status === 'fulfilled' && loansRes.value.loans) {
        setLoans(loansRes.value.loans);
      }

      if (potsRes.status === 'fulfilled' && potsRes.value.pots) {
        setPots(potsRes.value.pots);
      }

      if (insightsRes.status === 'fulfilled' && insightsRes.value?.cards) {
        setInsights(insightsRes.value.cards.slice(0, 2));
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
      className="flex-1 bg-background-primary"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={t.brand.default}
        />
      }
    >
      {error ? (
        <View className="mx-4 mt-4 p-3 bg-status-error/10 rounded-xl flex-row justify-between items-center">
          <Text className="text-status-error text-sm flex-1">{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text className="text-brand-default font-semibold ml-3">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Balance Card */}
      <View className="m-4 p-6 bg-brand-default rounded-2xl">
        <Text className="text-white/70 text-sm font-medium mb-2">Available Balance</Text>
        <Text className="text-white text-4xl font-bold">
          {balance ? `£${parseFloat(balance.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}
        </Text>
        {balance?.account_name && (
          <Text className="text-white/80 text-sm mt-2">{balance.account_name}</Text>
        )}
        {balance?.account_number && (
          <Text className="text-white/50 text-xs mt-1">{balance.account_number}</Text>
        )}
      </View>

      {/* Proactive Insights (max 2, hidden when empty) */}
      {insights.length > 0 && (
        <View className="px-4 mb-2">
          {insights.map((insight, index) => (
            <InsightCard
              key={index}
              title={insight.title}
              message={insight.message}
              category={insight.category}
              changePercent={insight.change_percent}
              period={insight.period}
            />
          ))}
        </View>
      )}

      {/* Pots Section */}
      <View className="px-4 mb-6">
        <View style={styles.sectionHeader}>
          <Text className="text-text-tertiary text-xs font-medium uppercase tracking-wide">Savings Pots</Text>
          <TouchableOpacity onPress={() => router.push('/chat')}>
            <Text className="text-brand-default text-sm font-medium">+ New pot</Text>
          </TouchableOpacity>
        </View>
        {pots.length === 0 ? (
          <TouchableOpacity
            className="flex-row items-center bg-surface-primary border border-border-primary rounded-xl p-4 gap-3"
            onPress={() => router.push('/chat')}
          >
            <Text style={styles.createPotIcon}>🏦</Text>
            <View className="flex-1">
              <Text className="text-text-primary text-sm font-medium">Create a pot</Text>
              <Text className="text-text-tertiary text-xs mt-0.5">Save towards a goal</Text>
            </View>
            <Text className="text-brand-default text-lg">→</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.potsScroll}>
            {pots.slice(0, 3).map((pot) => (
              <View key={pot.id} className="w-28 bg-surface-primary border border-border-primary rounded-xl p-3.5 mr-2">
                <Text style={styles.potEmoji}>{pot.emoji || '🏦'}</Text>
                <Text className="text-text-tertiary text-xs mb-1" numberOfLines={1}>{pot.name}</Text>
                <Text className="text-text-primary text-sm font-semibold">
                  £{pot.balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </Text>
                {pot.goal_amount != null && pot.goal_amount > 0 && (
                  <View className="h-0.5 bg-border-primary rounded mt-2 overflow-hidden">
                    <View
                      className="h-full bg-brand-default rounded"
                      style={{ width: `${Math.min(100, pot.progress_percent ?? 0)}%` }}
                    />
                  </View>
                )}
              </View>
            ))}
            <TouchableOpacity
              className="w-28 bg-surface-primary border border-border-primary rounded-xl p-3.5 mr-2 justify-center items-center"
              onPress={() => router.push('/chat')}
            >
              <Text className="text-brand-default text-2xl font-light">+</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Quick Actions */}
      <View className="flex-row justify-around px-4 mb-6">
        <TouchableOpacity
          className="items-center bg-surface-primary border border-border-primary rounded-xl p-4 w-24"
          onPress={() => router.push('/chat')}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text className="text-text-primary text-xs font-medium mt-2">Ask Agent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="items-center bg-surface-primary border border-border-primary rounded-xl p-4 w-24"
          onPress={() => router.push('/(tabs)/transactions')}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text className="text-text-primary text-xs font-medium mt-2">History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="items-center bg-surface-primary border border-border-primary rounded-xl p-4 w-24"
          onPress={() => router.push('/chat')}
        >
          <Text style={styles.actionIcon}>💸</Text>
          <Text className="text-text-primary text-xs font-medium mt-2">Send</Text>
        </TouchableOpacity>
      </View>

      {/* Active Loans */}
      <View className="px-4 mb-6">
        <Text className="text-text-tertiary text-xs font-medium uppercase tracking-wide mb-3">Active Loans</Text>
        {loans.length === 0 ? (
          <View className="bg-surface-primary border border-border-primary rounded-xl p-4 flex-row items-center gap-3">
            <Text style={styles.emptyIcon}>🏦</Text>
            <Text className="text-text-tertiary text-sm">No active loans</Text>
          </View>
        ) : (
          loans.map((loan) => (
            <View key={loan.id} className="bg-surface-primary border border-border-primary rounded-xl p-4 mb-2">
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-primary text-lg font-semibold">
                  £{loan.principal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </Text>
                <Text className="text-status-success text-sm font-medium uppercase">{loan.status}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-tertiary text-sm">
                  Remaining: £{loan.remaining.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </Text>
                <Text className="text-text-tertiary text-sm">
                  Monthly: £{loan.monthly_payment.toFixed(2)}
                </Text>
              </View>
              <View className="h-1 bg-border-primary rounded overflow-hidden">
                <View
                  className="h-full bg-brand-default rounded"
                  style={{ width: `${Math.max(0, Math.min(100, ((loan.principal - loan.remaining) / loan.principal) * 100))}%` }}
                />
              </View>
            </View>
          ))
        )}
      </View>

      {/* Recent Transactions */}
      <View className="px-4 mb-6">
        <View style={styles.sectionHeader}>
          <Text className="text-text-tertiary text-xs font-medium uppercase tracking-wide">Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
            <Text className="text-brand-default text-sm font-medium">See All</Text>
          </TouchableOpacity>
        </View>
        {transactions.length === 0 ? (
          <View className="bg-surface-primary border border-border-primary rounded-xl p-4 flex-row items-center gap-3">
            <Text style={styles.emptyIcon}>📋</Text>
            <Text className="text-text-tertiary text-sm">No recent transactions</Text>
          </View>
        ) : (
          transactions.map((tx, index) => (
            <View key={index} className="flex-row justify-between items-center bg-surface-primary border border-border-primary rounded-lg p-3.5 mb-1.5">
              <View>
                <Text className="text-text-primary text-sm">{tx.type}</Text>
                <Text className="text-text-tertiary text-xs mt-0.5">{new Date(tx.date).toLocaleDateString('en-GB')}</Text>
              </View>
              <Text
                className={`text-sm font-semibold ${tx.direction === 'credit' ? 'text-money-positive' : 'text-money-negative'}`}
              >
                {tx.direction === 'credit' ? '+' : '-'}£{Math.abs(parseFloat(tx.amount)).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* CTA to chat */}
      <TouchableOpacity
        className="mx-4 p-4 bg-brand-default rounded-xl items-center"
        onPress={() => router.push('/chat')}
      >
        <Text className="text-white text-sm font-medium">Need help? Chat with your banking assistant</Text>
      </TouchableOpacity>

      <View className="h-10" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  potsScroll: { marginHorizontal: -4 },
  createPotIcon: { fontSize: 24 },
  potEmoji: { fontSize: 22, marginBottom: 6 },
  actionIcon: { fontSize: 24 },
  emptyIcon: { fontSize: 20 },
});

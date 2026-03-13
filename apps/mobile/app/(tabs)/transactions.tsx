import { useState, useCallback } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getTransactions as fetchTransactions } from '../../lib/api';
import { useTokens } from '../../theme/tokens';

interface Transaction {
  amount: string;
  currency: string;
  direction: string;
  type: string;
  date: string;
  balance_after?: string;
}

interface TransactionSection {
  title: string;
  data: Transaction[];
}

export default function TransactionsScreen() {
  const [sections, setSections] = useState<TransactionSection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const t = useTokens();

  const loadTransactions = useCallback(async () => {
    try {
      const response = await fetchTransactions(50);

      if (response.transactions) {
        const txs: Transaction[] = response.transactions;

        // Group by date
        const grouped = new Map<string, Transaction[]>();
        for (const tx of txs) {
          const dateKey = new Date(tx.date).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          });
          if (!grouped.has(dateKey)) grouped.set(dateKey, []);
          grouped.get(dateKey)!.push(tx);
        }

        setSections(
          Array.from(grouped.entries()).map(([title, data]) => ({ title, data }))
        );
      }
    } catch {
      // Silently fail — user can pull to refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadTransactions();
    }, [loadTransactions])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background-primary justify-center items-center p-6">
        <ActivityIndicator size="large" color={t.brand.default} />
        <Text className="text-text-tertiary text-sm mt-3">Loading transactions...</Text>
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View className="flex-1 bg-background-primary justify-center items-center p-6">
        <Text className="text-5xl mb-4">📋</Text>
        <Text className="text-text-primary text-lg font-semibold mb-2">No transactions yet</Text>
        <Text className="text-text-tertiary text-sm text-center">
          Transactions will appear here once you start using your account
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background-primary">
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.date}-${index}`}
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-4 py-2 bg-background-primary">
            <Text className="text-text-tertiary text-xs font-medium">{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 border-b border-border-primary"
            onPress={() => setSelectedTx(item)}
          >
            <View
              className="w-9 h-9 rounded-full bg-surface-secondary justify-center items-center mr-3"
            >
              <Text className="text-brand-default text-base font-bold">
                {item.direction === 'credit' ? '↓' : '↑'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-text-primary text-sm">{item.type}</Text>
              <Text className="text-text-tertiary text-xs mt-0.5">
                {new Date(item.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text
              className={`text-sm font-semibold ${item.direction === 'credit' ? 'text-money-positive' : 'text-money-negative'}`}
            >
              {item.direction === 'credit' ? '+' : '-'}£{Math.abs(parseFloat(item.amount)).toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.brand.default}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* Transaction detail modal — pageSheet enables swipe-to-dismiss on iOS */}
      <Modal
        visible={!!selectedTx}
        transparent
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTx(null)}
      >
        <View className="flex-1 bg-background-primary">
          <View className="flex-row justify-between items-center px-6 pt-6 pb-4 border-b border-border-primary">
            <Text className="text-text-primary text-xl font-bold">Transaction Details</Text>
            <TouchableOpacity
              className="w-8 h-8 rounded-full bg-surface-secondary items-center justify-center"
              onPress={() => setSelectedTx(null)}
            >
              <Text className="text-text-secondary text-sm font-semibold">✕</Text>
            </TouchableOpacity>
          </View>

          {selectedTx && (
            <View className="px-6 pt-4">
              <View className="flex-row justify-between py-3 border-b border-border-primary">
                <Text className="text-text-tertiary text-sm">Type</Text>
                <Text className="text-text-primary text-sm font-medium">{selectedTx.type}</Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-border-primary">
                <Text className="text-text-tertiary text-sm">Amount</Text>
                <Text
                  className={`text-sm font-medium ${selectedTx.direction === 'credit' ? 'text-money-positive' : 'text-money-negative'}`}
                >
                  {selectedTx.direction === 'credit' ? '+' : '-'}£{Math.abs(parseFloat(selectedTx.amount)).toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-border-primary">
                <Text className="text-text-tertiary text-sm">Direction</Text>
                <Text className="text-text-primary text-sm font-medium capitalize">{selectedTx.direction}</Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-border-primary">
                <Text className="text-text-tertiary text-sm">Date</Text>
                <Text className="text-text-primary text-sm font-medium">
                  {new Date(selectedTx.date).toLocaleString('en-GB')}
                </Text>
              </View>
              {selectedTx.balance_after && (
                <View className="flex-row justify-between py-3 border-b border-border-primary">
                  <Text className="text-text-tertiary text-sm">Balance After</Text>
                  <Text className="text-text-primary text-sm font-medium">
                    £{parseFloat(selectedTx.balance_after).toFixed(2)}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                className="mt-6 bg-brand-default py-3.5 rounded-xl items-center"
                onPress={() => setSelectedTx(null)}
              >
                <Text className="text-white text-base font-semibold">Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

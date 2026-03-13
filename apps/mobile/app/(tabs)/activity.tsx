import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  RefreshControl, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getTransactions as fetchTransactions } from '../../lib/api';
import { Skeleton } from '../../components/Skeleton';
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

function ActivitySkeleton() {
  return (
    <View>
      {[1, 2].map((section) => (
        <View key={section}>
          <View className="px-4 pt-4 pb-1.5">
            <Skeleton width={120} height={12} />
          </View>
          {[1, 2, 3].map((i) => (
            <View key={i} className="flex-row items-center px-4 py-3.5">
              <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 12 }} />
              <View className="flex-1">
                <Skeleton width={120} height={14} style={{ marginBottom: 6 }} />
                <Skeleton width={80} height={11} />
              </View>
              <Skeleton width={60} height={14} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function ActivityScreen() {
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

        const grouped = new Map<string, Transaction[]>();
        for (const tx of txs) {
          const dateKey = new Date(tx.date).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          });
          if (!grouped.has(dateKey)) grouped.set(dateKey, []);
          grouped.get(dateKey)!.push(tx);
        }

        setSections(
          Array.from(grouped.entries()).map(([title, data]) => ({ title, data }))
        );
      }
    } catch {
      // Silently fail — pull to refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadTransactions();
  }, [loadTransactions]));

  if (loading) {
    return (
      <View className="flex-1 bg-background-primary">
        <ActivitySkeleton />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View className="flex-1 bg-background-primary justify-center items-center p-6">
        <Text style={styles.emptyIcon}>📋</Text>
        <Text className="text-text-primary text-lg font-semibold mb-2">No transactions yet</Text>
        <Text className="text-text-tertiary text-sm text-center">Your transactions will appear here</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background-primary">
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.date}-${index}`}
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-4 pt-4 pb-1.5 bg-background-primary">
            <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wide">{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 border-b border-surface-primary"
            onPress={() => setSelectedTx(item)}
          >
            <View
              className="w-9 h-9 rounded-full justify-center items-center mr-3"
              style={item.direction === 'credit' ? styles.txIconCredit : styles.txIconDebit}
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
            onRefresh={() => { setRefreshing(true); loadTransactions(); }}
            tintColor={t.brand.default}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
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

const styles = StyleSheet.create({
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  txIconCredit: { backgroundColor: 'rgba(52, 211, 153, 0.12)' },
  txIconDebit: { backgroundColor: 'rgba(15, 23, 42, 0.08)' },
});

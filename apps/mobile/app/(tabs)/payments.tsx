import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getTransactions as fetchTransactions, getBeneficiaries } from '../../lib/api';
import { Skeleton } from '../../components/Skeleton';
import { useTokens } from '../../theme/tokens';

interface PaymentItem {
  amount: string;
  direction: string;
  type: string;
  date: string;
}

interface Beneficiary {
  id: string;
  name: string;
  account_number?: string;
  sort_code?: string;
}

// Hash beneficiary name to a palette color for differentiated avatars
const AVATAR_COLORS = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393'];
function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xFFFFFFFF;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function PaymentsSkeleton() {
  return (
    <View className="p-4">
      <View className="flex-row gap-3 mb-6">
        <Skeleton width="48%" height={72} borderRadius={14} />
        <Skeleton width="48%" height={72} borderRadius={14} />
      </View>
      <Skeleton width={120} height={12} style={{ marginBottom: 12 }} />
      <View className="flex-row gap-3 mb-6">
        {[1, 2, 3].map((i) => (
          <View key={i} className="items-center">
            <Skeleton width={48} height={48} borderRadius={24} style={{ marginBottom: 6 }} />
            <Skeleton width={40} height={10} />
          </View>
        ))}
      </View>
      <Skeleton width={120} height={12} style={{ marginBottom: 12 }} />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} width="100%" height={56} borderRadius={8} style={{ marginBottom: 8 }} />
      ))}
    </View>
  );
}

export default function PaymentsScreen() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const t = useTokens();

  const loadPayments = useCallback(async () => {
    try {
      const [txRes, benRes] = await Promise.allSettled([
        fetchTransactions(20),
        getBeneficiaries(),
      ]);

      if (txRes.status === 'fulfilled' && txRes.value.transactions) {
        setPayments(
          txRes.value.transactions.filter((tx: PaymentItem) => tx.direction === 'debit' && tx.type === 'payment')
        );
      }

      if (benRes.status === 'fulfilled' && benRes.value.beneficiaries) {
        setBeneficiaries(benRes.value.beneficiaries);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadPayments();
  }, [loadPayments]));

  const openChat = () => router.push('/chat');

  if (loading) {
    return (
      <View className="flex-1 bg-background-primary">
        <PaymentsSkeleton />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background-primary p-4">
      {/* Action buttons */}
      <View className="flex-row gap-3 mb-6">
        <TouchableOpacity
          className="flex-1 bg-brand-default rounded-2xl py-4 items-center gap-1.5"
          onPress={openChat}
        >
          <Text className="text-white text-xl">↑</Text>
          <Text className="text-white text-sm font-semibold">Send money</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-surface-primary border border-border-primary rounded-2xl py-4 items-center gap-1.5"
          onPress={openChat}
        >
          <Text className="text-brand-default text-xl">+</Text>
          <Text className="text-text-tertiary text-sm font-semibold">Add payee</Text>
        </TouchableOpacity>
      </View>

      {/* Send to... Beneficiaries */}
      {beneficiaries.length > 0 && (
        <View className="mb-5">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wide">Send to...</Text>
            {beneficiaries.length > 6 && (
              <TouchableOpacity onPress={openChat}>
                <Text className="text-brand-default text-sm font-medium">See all</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beneficiariesScroll}>
            {beneficiaries.slice(0, 6).map((ben) => (
              <TouchableOpacity
                key={ben.id}
                className="items-center mx-2 w-14"
                onPress={openChat}
              >
                <View
                  className="w-12 h-12 rounded-full justify-center items-center mb-1.5"
                  style={{ backgroundColor: avatarColor(ben.name) }}
                >
                  <Text className="text-white text-lg font-bold">
                    {ben.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-text-tertiary text-xs text-center" numberOfLines={1}>
                  {ben.name.slice(0, 8)}
                </Text>
              </TouchableOpacity>
            ))}
            {/* Add new payee shortcut */}
            <TouchableOpacity
              className="items-center mx-2 w-14"
              onPress={openChat}
            >
              <View className="w-12 h-12 rounded-full bg-surface-secondary border border-border-primary justify-center items-center mb-1.5">
                <Text className="text-brand-default text-xl font-light">+</Text>
              </View>
              <Text className="text-text-tertiary text-xs text-center">Add new</Text>
            </TouchableOpacity>
          </ScrollView>
          {/* Manage payees hint */}
          <Text className="text-text-tertiary text-xs mt-2">
            Manage payees in{' '}
            <Text className="text-brand-default" onPress={openChat}>chat</Text>
          </Text>
        </View>
      )}

      {/* Standing Orders CTA */}
      <View className="mb-5">
        <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wide mb-3">Standing Orders</Text>
        <TouchableOpacity
          className="flex-row items-center bg-surface-primary border border-border-primary rounded-xl p-4 gap-3"
          onPress={openChat}
        >
          <Text style={styles.standingOrderIcon}>🔄</Text>
          <View className="flex-1">
            <Text className="text-text-primary text-sm font-medium">Manage standing orders</Text>
            <Text className="text-text-tertiary text-xs mt-0.5">View, create or cancel recurring payments</Text>
          </View>
          <Text className="text-brand-default text-base">→</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wide mb-3">Recent Payments</Text>

      {payments.length === 0 ? (
        <View className="items-center py-10">
          <Text style={styles.emptyIcon}>💸</Text>
          <Text className="text-text-primary text-lg font-semibold mb-2">No payments yet</Text>
          <Text className="text-text-tertiary text-sm">Ask the assistant to send money</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(_, i) => `payment-${i}`}
          renderItem={({ item }) => (
            <View className="flex-row items-center py-3.5 border-b border-surface-primary">
              <View className="w-9 h-9 rounded-full bg-surface-primary justify-center items-center mr-3">
                <Text className="text-status-error text-base font-bold">↑</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text-primary text-sm">{item.type}</Text>
                <Text className="text-text-tertiary text-xs mt-0.5">{new Date(item.date).toLocaleDateString('en-GB')}</Text>
              </View>
              <Text className="text-status-error text-sm font-semibold">
                -£{Math.abs(parseFloat(item.amount)).toFixed(2)}
              </Text>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadPayments(); }}
              tintColor={t.brand.default}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  beneficiariesScroll: { marginHorizontal: -4 },
  standingOrderIcon: { fontSize: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
});

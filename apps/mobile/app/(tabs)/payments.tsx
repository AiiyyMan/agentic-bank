import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getTransactions as fetchTransactions, getBeneficiaries } from '../../lib/api';

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

export default function PaymentsScreen() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPayments = useCallback(async () => {
    try {
      const [txRes, benRes] = await Promise.allSettled([
        fetchTransactions(20),
        getBeneficiaries(),
      ]);

      if (txRes.status === 'fulfilled' && txRes.value.transactions) {
        // Filter to outgoing payments only
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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]} onPress={openChat}>
          <Text style={styles.actionIcon}>↑</Text>
          <Text style={styles.actionLabel}>Send money</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/chat')}
        >
          <Text style={[styles.actionIcon, styles.actionIconSecondary]}>+</Text>
          <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>Add payee</Text>
        </TouchableOpacity>
      </View>

      {/* Send to... Beneficiaries */}
      {beneficiaries.length > 0 && (
        <View style={styles.beneficiariesSection}>
          <View style={styles.beneficiariesHeader}>
            <Text style={styles.sectionTitle}>Send to...</Text>
            {beneficiaries.length > 6 && (
              <TouchableOpacity onPress={openChat}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beneficiariesScroll}>
            {beneficiaries.slice(0, 6).map((ben) => (
              <TouchableOpacity
                key={ben.id}
                style={styles.beneficiaryItem}
                onPress={openChat}
              >
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>
                    {ben.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.beneficiaryName} numberOfLines={1}>
                  {ben.name.slice(0, 8)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={styles.sectionTitle}>Recent Payments</Text>

      {payments.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyText}>No payments yet</Text>
          <Text style={styles.emptySubtext}>Ask the assistant to send money</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(_, i) => `payment-${i}`}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Text style={styles.rowIconText}>↑</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{item.type}</Text>
                <Text style={styles.rowDate}>{new Date(item.date).toLocaleDateString('en-GB')}</Text>
              </View>
              <Text style={styles.rowAmount}>
                -£{Math.abs(parseFloat(item.amount)).toFixed(2)}
              </Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPayments(); }} tintColor="#6c5ce7" />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: 40 },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionButton: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 6 },
  actionButtonPrimary: { backgroundColor: '#6c5ce7' },
  actionButtonSecondary: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2d2d44' },
  actionIcon: { fontSize: 22, color: '#fff' },
  actionIconSecondary: { color: '#6c5ce7' },
  actionLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionLabelSecondary: { color: '#8b8ba7' },

  sectionTitle: { color: '#8b8ba7', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowIconText: { color: '#e74c3c', fontSize: 16, fontWeight: '700' },
  rowInfo: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 15 },
  rowDate: { color: '#555', fontSize: 12, marginTop: 2 },
  rowAmount: { color: '#e74c3c', fontSize: 15, fontWeight: '600' },

  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#8b8ba7', fontSize: 14 },

  beneficiariesSection: { marginBottom: 20 },
  beneficiariesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { color: '#6c5ce7', fontSize: 13, fontWeight: '500' },
  beneficiariesScroll: { marginHorizontal: -4 },
  beneficiaryItem: { alignItems: 'center', marginHorizontal: 8, width: 56 },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatarLetter: { color: '#fff', fontSize: 18, fontWeight: '700' },
  beneficiaryName: { color: '#8b8ba7', fontSize: 11, textAlign: 'center' },
});

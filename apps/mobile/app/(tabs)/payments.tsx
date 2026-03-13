import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getTransactions as fetchTransactions } from '../../lib/api';

interface PaymentItem {
  amount: string;
  direction: string;
  type: string;
  date: string;
}

export default function PaymentsScreen() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPayments = useCallback(async () => {
    try {
      const response = await fetchTransactions(20);
      if (response.transactions) {
        // Filter to outgoing payments only
        setPayments(
          response.transactions.filter((tx: PaymentItem) => tx.direction === 'debit' && tx.type === 'payment')
        );
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
      {/* Send payment CTA */}
      <TouchableOpacity style={styles.sendButton} onPress={openChat}>
        <Text style={styles.sendIcon}>↑</Text>
        <View>
          <Text style={styles.sendTitle}>Send money</Text>
          <Text style={styles.sendSubtitle}>Ask your banking assistant</Text>
        </View>
      </TouchableOpacity>

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

  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  sendIcon: { fontSize: 24, color: '#fff', width: 36, textAlign: 'center' },
  sendTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sendSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },

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
});

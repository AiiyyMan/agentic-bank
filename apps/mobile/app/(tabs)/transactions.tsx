import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sendChatMessage } from '../../lib/api';

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

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await sendChatMessage({ message: 'Show my last 50 transactions' });

      // Extract transactions from agent response
      if (response.ui_components) {
        const txCard = response.ui_components.find((c: any) => c.type === 'transaction_list');
        if (txCard && (txCard.data as any).transactions) {
          const txs: Transaction[] = (txCard.data as any).transactions;

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
      fetchTransactions();
    }, [fetchTransactions])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6c5ce7" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No transactions yet</Text>
        <Text style={styles.emptySubtext}>Transactions will appear here once you start using your account</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.date}-${index}`}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.txRow} onPress={() => setSelectedTx(item)}>
            <View style={styles.txIcon}>
              <Text style={styles.txIconText}>
                {item.direction === 'credit' ? '↓' : '↑'}
              </Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txType}>{item.type}</Text>
              <Text style={styles.txTime}>
                {new Date(item.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={[styles.txAmount, item.direction === 'credit' ? styles.credit : styles.debit]}>
              {item.direction === 'credit' ? '+' : '-'}£{Math.abs(parseFloat(item.amount)).toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* Transaction detail modal */}
      <Modal visible={!!selectedTx} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Transaction Details</Text>

            {selectedTx && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{selectedTx.type}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={[styles.detailValue, selectedTx.direction === 'credit' ? styles.credit : styles.debit]}>
                    {selectedTx.direction === 'credit' ? '+' : '-'}£{Math.abs(parseFloat(selectedTx.amount)).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Direction</Text>
                  <Text style={styles.detailValue}>{selectedTx.direction}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedTx.date).toLocaleString('en-GB')}
                  </Text>
                </View>
                {selectedTx.balance_after && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Balance After</Text>
                    <Text style={styles.detailValue}>£{parseFloat(selectedTx.balance_after).toFixed(2)}</Text>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedTx(null)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#8b8ba7', marginTop: 12, fontSize: 14 },

  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#8b8ba7', fontSize: 14, textAlign: 'center' },

  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0f0f23' },
  sectionTitle: { color: '#8b8ba7', fontSize: 13, fontWeight: '500' },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txIconText: { color: '#6c5ce7', fontSize: 16, fontWeight: '700' },
  txInfo: { flex: 1 },
  txType: { color: '#fff', fontSize: 15 },
  txTime: { color: '#555', fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '600' },
  credit: { color: '#2ecc71' },
  debit: { color: '#e74c3c' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  detailLabel: { color: '#8b8ba7', fontSize: 14 },
  detailValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
  closeButton: {
    marginTop: 24,
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

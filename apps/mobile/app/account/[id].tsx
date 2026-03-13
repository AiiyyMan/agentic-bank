import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Clipboard,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getBalance, getTransactions } from '../../lib/api';
import { TransactionRow } from '../../components/banking/TransactionRow';
import { DateGroupHeader } from '../../components/banking/DateGroupHeader';

interface AccountDetail {
  balance: string;
  currency: string;
  account_name?: string;
  account_number?: string;
  sort_code?: string;
}

interface Transaction {
  amount: string;
  currency: string;
  direction: 'credit' | 'debit';
  type: string;
  date: string;
  primary_category?: string;
}

function formatSortCode(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 6) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  }
  return raw;
}

function groupByDate(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    const day = new Date(tx.date).toDateString();
    if (!groups[day]) groups[day] = [];
    groups[day].push(tx);
  }
  return Object.entries(groups).map(([, items]) => ({
    date: items[0].date,
    items,
  }));
}

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [balanceRes, txRes] = await Promise.allSettled([
        getBalance(),
        getTransactions(10),
      ]);

      if (balanceRes.status === 'fulfilled') {
        setAccount(balanceRes.value as AccountDetail);
      }

      if (txRes.status === 'fulfilled' && txRes.value.transactions) {
        setTransactions(txRes.value.transactions.slice(0, 10));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useState(() => {
    loadData();
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const copyToClipboard = (value: string, field: string) => {
    Clipboard.setString(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  const groups = groupByDate(transactions);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Details</Text>
        <View style={styles.backButton} />
      </View>

      {/* Account Card */}
      <View style={styles.accountCard}>
        <Text style={styles.accountName}>{account?.account_name || 'Current Account'}</Text>
        <Text style={styles.balanceAmount}>
          {account
            ? `£${parseFloat(account.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
            : '—'}
        </Text>
        <Text style={styles.balanceCurrency}>{account?.currency || 'GBP'}</Text>

        <View style={styles.divider} />

        {/* Sort Code */}
        {account?.sort_code && (
          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => copyToClipboard(account.sort_code!, 'sort_code')}
          >
            <View>
              <Text style={styles.detailLabel}>Sort code</Text>
              <Text style={styles.detailValue}>{formatSortCode(account.sort_code)}</Text>
            </View>
            <Text style={styles.copyHint}>
              {copiedField === 'sort_code' ? '✓ Copied' : 'Tap to copy'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Account Number */}
        {account?.account_number && (
          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => copyToClipboard(account.account_number!, 'account_number')}
          >
            <View>
              <Text style={styles.detailLabel}>Account number</Text>
              <Text style={styles.detailValue}>{account.account_number}</Text>
            </View>
            <Text style={styles.copyHint}>
              {copiedField === 'account_number' ? '✓ Copied' : 'Tap to copy'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          groups.map((group, gi) => (
            <View key={gi}>
              <DateGroupHeader date={group.date} />
              {group.items.map((tx, ti) => (
                <TransactionRow
                  key={`${gi}-${ti}`}
                  amount={tx.amount}
                  currency={tx.currency}
                  direction={tx.direction}
                  type={tx.type}
                  date={tx.date}
                  primary_category={tx.primary_category}
                />
              ))}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  backArrow: { color: '#6c5ce7', fontSize: 20, marginRight: 4 },
  backText: { color: '#6c5ce7', fontSize: 15, fontWeight: '500' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },

  accountCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  accountName: { color: '#8b8ba7', fontSize: 13, marginBottom: 8 },
  balanceAmount: { color: '#fff', fontSize: 40, fontWeight: '700', marginBottom: 4 },
  balanceCurrency: { color: '#8b8ba7', fontSize: 13 },

  divider: {
    height: 1,
    backgroundColor: '#2d2d44',
    marginVertical: 20,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  detailLabel: { color: '#8b8ba7', fontSize: 12, marginBottom: 4 },
  detailValue: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  copyHint: { color: '#6c5ce7', fontSize: 12 },

  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: {
    color: '#8b8ba7',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },

  emptyState: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  emptyText: { color: '#8b8ba7', fontSize: 14 },
});

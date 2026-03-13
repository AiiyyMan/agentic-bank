import { useState, useCallback } from 'react';
import {
  View,
  Text,
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
import { useTokens } from '../../theme/tokens';

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
  const t = useTokens();

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
      <View className="flex-1 bg-background-primary justify-center items-center">
        <ActivityIndicator size="large" color={t.brand.default} />
      </View>
    );
  }

  const groups = groupByDate(transactions);

  return (
    <ScrollView
      className="flex-1 bg-background-primary"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.brand.default} />
      }
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-4">
        <TouchableOpacity className="flex-row items-center w-20" onPress={() => router.back()}>
          <Text className="text-brand-default text-xl mr-1">←</Text>
          <Text className="text-brand-default text-sm font-medium">Back</Text>
        </TouchableOpacity>
        <Text className="text-text-primary text-base font-semibold">Account Details</Text>
        <View className="w-20" />
      </View>

      {/* Account Card */}
      <View className="mx-4 p-6 bg-surface-primary border border-brand-default rounded-2xl mb-4">
        <Text className="text-text-tertiary text-sm mb-2">{account?.account_name || 'Current Account'}</Text>
        <Text className="text-text-primary text-4xl font-bold mb-1">
          {account
            ? `£${parseFloat(account.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
            : '—'}
        </Text>
        <Text className="text-text-tertiary text-sm">{account?.currency || 'GBP'}</Text>

        <View className="h-px bg-border-primary my-5" />

        {/* Sort Code */}
        {account?.sort_code && (
          <TouchableOpacity
            className="flex-row justify-between items-center py-3 border-b border-border-primary"
            onPress={() => copyToClipboard(account.sort_code!, 'sort_code')}
          >
            <View>
              <Text className="text-text-tertiary text-xs mb-1">Sort code</Text>
              <Text className="text-text-primary text-base font-semibold tracking-wide">
                {formatSortCode(account.sort_code)}
              </Text>
            </View>
            <Text className="text-brand-default text-xs">
              {copiedField === 'sort_code' ? '✓ Copied' : 'Tap to copy'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Account Number */}
        {account?.account_number && (
          <TouchableOpacity
            className="flex-row justify-between items-center py-3 border-b border-border-primary"
            onPress={() => copyToClipboard(account.account_number!, 'account_number')}
          >
            <View>
              <Text className="text-text-tertiary text-xs mb-1">Account number</Text>
              <Text className="text-text-primary text-base font-semibold tracking-wide">
                {account.account_number}
              </Text>
            </View>
            <Text className="text-brand-default text-xs">
              {copiedField === 'account_number' ? '✓ Copied' : 'Tap to copy'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transactions */}
      <View className="px-4 mb-6">
        <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wide mb-2 mt-2">
          Recent Transactions
        </Text>
        {transactions.length === 0 ? (
          <View className="p-6 items-center bg-surface-primary border border-border-primary rounded-xl">
            <Text className="text-text-tertiary text-sm">No transactions yet</Text>
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

      <View className="h-10" />
    </ScrollView>
  );
}

import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getLoans, getCreditScore } from '../../lib/api';
import { LoanStatusCard } from '../../components/chat/LoanStatusCard';
import { CreditScoreCard } from '../../components/chat/CreditScoreCard';
import { Skeleton } from '../../components/Skeleton';

interface Loan {
  id: string;
  principal: number;
  remaining: number;
  rate: number;
  monthly_payment: number;
  next_payment_date: string;
  status: string;
}

interface CreditScoreData {
  score: number;
  rating: 'poor' | 'fair' | 'good' | 'excellent';
  factors?: { positive: string[]; improve: string[] };
}

function bandToRating(band: string): 'poor' | 'fair' | 'good' | 'excellent' {
  switch (band) {
    case 'Excellent': return 'excellent';
    case 'Good': return 'good';
    case 'Fair': return 'fair';
    default: return 'poor';
  }
}

function LoansSkeleton() {
  return (
    <View className="p-4">
      <Skeleton width="100%" height={120} borderRadius={16} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={160} borderRadius={16} style={{ marginBottom: 12 }} />
    </View>
  );
}

export default function LoansScreen() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [creditScore, setCreditScore] = useState<CreditScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const [loansRes, scoreRes] = await Promise.allSettled([
        getLoans(),
        getCreditScore(),
      ]);

      if (loansRes.status === 'fulfilled' && loansRes.value?.loans) {
        setLoans(loansRes.value.loans);
      }

      if (scoreRes.status === 'fulfilled' && scoreRes.value?.score) {
        const s = scoreRes.value;
        setCreditScore({
          score: s.score,
          rating: bandToRating(s.rating || s.band || 'fair'),
          factors: s.factors
            ? {
                positive: Object.entries(s.factors as Record<string, number>)
                  .filter(([, v]) => v > 0)
                  .map(([k]) => k.replace(/_/g, ' ')),
                improve: Object.entries(s.factors as Record<string, number>)
                  .filter(([, v]) => v === 0)
                  .map(([k]) => `Improve your ${k.replace(/_/g, ' ')}`),
              }
            : undefined,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load lending data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openApplyChat = () => {
    router.push('/chat');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background-primary">
        <LoansSkeleton />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background-primary"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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

      {/* Credit Score */}
      {creditScore ? (
        <View className="px-4 mt-4">
          <Text className="text-text-tertiary text-xs font-medium uppercase mb-2">Your Credit Score</Text>
          <CreditScoreCard
            score={creditScore.score}
            rating={creditScore.rating}
            factors={creditScore.factors}
          />
        </View>
      ) : null}

      {/* Active Loans */}
      <View className="px-4 mt-4">
        <Text className="text-text-tertiary text-xs font-medium uppercase mb-2">Active Loans</Text>

        {loans.length === 0 ? (
          <View className="bg-surface-primary border border-border-primary rounded-2xl p-8 items-center">
            <Text className="text-4xl mb-3">🏦</Text>
            <Text className="text-text-primary text-lg font-semibold mb-2">No active loans</Text>
            <Text className="text-text-tertiary text-sm text-center">
              You have no active loans at the moment.
            </Text>
          </View>
        ) : (
          loans.map((loan) => (
            <LoanStatusCard
              key={loan.id}
              principal={String(loan.principal)}
              remaining={String(loan.remaining)}
              rate={String(loan.rate)}
              monthlyPayment={String(loan.monthly_payment)}
              nextDate={loan.next_payment_date}
              status={loan.status}
            />
          ))
        )}
      </View>

      {/* Apply CTA */}
      <View className="px-4 mt-6 items-center">
        <TouchableOpacity
          onPress={openApplyChat}
          className="w-full bg-brand-default rounded-xl py-3.5 items-center mb-2"
        >
          <Text className="text-white font-semibold text-base">Apply for a Loan</Text>
        </TouchableOpacity>
        <Text className="text-text-tertiary text-xs text-center">
          Chat with your banking assistant to explore loan options
        </Text>
      </View>

      <View className="h-10" />
    </ScrollView>
  );
}

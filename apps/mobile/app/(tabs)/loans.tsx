import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getLoans, getCreditScore, getFlexPlans } from '../../lib/api';
import { LoanStatusCard } from '../../components/chat/LoanStatusCard';
import { CreditScoreCard } from '../../components/chat/CreditScoreCard';
import { FlexPlanCard } from '../../components/chat/FlexPlanCard';
import { Skeleton } from '../../components/Skeleton';

interface Loan {
  id: string;
  principal: number;
  remaining: number;
  rate: number;
  monthly_payment: number;
  next_payment_date: string;
  status: string;
  payments_made?: number;
  term_months?: number;
  payoff_date?: string;
}

interface CreditScoreData {
  score: number;
  rating: 'poor' | 'fair' | 'good' | 'excellent';
  factors?: { positive: string[]; improve: string[] };
}

interface FlexPlan {
  id: string;
  merchant_name: string;
  original_amount: number;
  remaining: number;
  monthly_payment: number;
  plan_months: number;
  payments_made: number;
  apr: number;
  status: string;
}

function bandToRating(band: string): 'poor' | 'fair' | 'good' | 'excellent' {
  switch (band.toLowerCase()) {
    case 'excellent': return 'excellent';
    case 'good': return 'good';
    case 'fair': return 'fair';
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
  const [flexPlans, setFlexPlans] = useState<FlexPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const [loansRes, scoreRes, flexRes] = await Promise.allSettled([
        getLoans(),
        getCreditScore(),
        getFlexPlans(),
      ]);

      if (loansRes.status === 'fulfilled' && loansRes.value?.loans) {
        setLoans(loansRes.value.loans);
      }

      if (scoreRes.status === 'fulfilled' && scoreRes.value?.score) {
        const s = scoreRes.value;
        setCreditScore({
          score: s.score,
          rating: bandToRating(s.rating || s.band || 'fair'),
          factors: (s.factors || s.improvement_tips)
            ? {
                positive: (s.factors || []) as string[],
                improve: (s.improvement_tips || []) as string[],
              }
            : undefined,
        });
      }

      if (flexRes.status === 'fulfilled' && flexRes.value?.plans) {
        setFlexPlans(flexRes.value.plans.filter((p: FlexPlan) => p.status === 'active'));
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
              paymentsMade={loan.payments_made}
              termMonths={loan.term_months}
              payoffDate={loan.payoff_date}
            />
          ))
        )}
      </View>

      {/* Flex Plans */}
      <View className="px-4 mt-4">
        <Text className="text-text-tertiary text-xs font-medium uppercase mb-2">Flex Plans</Text>
        {flexPlans.length === 0 ? (
          <View className="bg-surface-primary border border-border-primary rounded-2xl p-6 items-center">
            <Text className="text-text-tertiary text-sm text-center">No active Flex plans</Text>
          </View>
        ) : (
          <FlexPlanCard plans={flexPlans} />
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

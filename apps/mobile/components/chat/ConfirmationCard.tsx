import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { confirmAction, rejectAction } from '../../lib/api';
import { useTokens } from '../../theme/tokens';

interface ConfirmationCardProps {
  pendingActionId: string;
  summary: string;
  details: Record<string, string>;
  postTransactionBalance?: string;
  onConfirmed?: () => void;
  onRejected?: () => void;
}

type ConfirmationStatus = 'pending' | 'confirming' | 'confirmed' | 'rejected' | 'expired' | 'error';

export function ConfirmationCard({
  pendingActionId,
  summary,
  details,
  postTransactionBalance,
  onConfirmed,
  onRejected,
}: ConfirmationCardProps) {
  const [status, setStatus] = useState<ConfirmationStatus>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const t = useTokens();

  const handleConfirm = async () => {
    setStatus('confirming');
    try {
      const result = await confirmAction(pendingActionId);
      if (result.success) {
        setStatus('confirmed');
        onConfirmed?.();
      } else {
        const msg = result.message || 'Something went wrong';
        if (msg.toLowerCase().includes('expired')) {
          setStatus('expired');
          setErrorMessage(msg);
        } else {
          setStatus('error');
          setErrorMessage(msg);
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to confirm';
      if (msg.toLowerCase().includes('expired')) {
        setStatus('expired');
        setErrorMessage(msg);
      } else {
        setStatus('error');
        setErrorMessage(msg);
      }
    }
  };

  const handleReject = async () => {
    try {
      await rejectAction(pendingActionId);
      setStatus('rejected');
      onRejected?.();
    } catch {
      // Silent fail on reject
      setStatus('rejected');
    }
  };

  const isExpired = status === 'expired';

  return (
    <View
      className={`rounded-2xl p-4 my-2 mx-1 border ${isExpired ? 'bg-surface-primary border-border-primary opacity-75' : 'bg-surface-primary border-brand-default'}`}
    >
      <Text className={`text-xs font-semibold uppercase mb-2 ${isExpired ? 'text-text-tertiary' : 'text-brand-default'}`}>
        Confirm Action
      </Text>
      <Text className={`text-base font-semibold mb-3 ${isExpired ? 'text-text-tertiary' : 'text-text-primary'}`}>
        {summary}
      </Text>

      <View className="mb-4">
        {Object.entries(details).map(([key, value]) => (
          <View key={key} className="flex-row justify-between py-1.5 border-b border-border-primary">
            <Text className={`text-sm ${isExpired ? 'text-text-disabled' : 'text-text-tertiary'}`}>{key}</Text>
            <Text className={`text-sm font-medium ${isExpired ? 'text-text-disabled' : 'text-text-primary'}`}>{value}</Text>
          </View>
        ))}
        {postTransactionBalance && (
          <View className="flex-row justify-between py-1.5 border-b border-border-primary">
            <Text className={`text-sm ${isExpired ? 'text-text-disabled' : 'text-text-tertiary'}`}>Balance after</Text>
            <Text className={`text-sm font-medium ${isExpired ? 'text-text-disabled' : 'text-text-tertiary'}`}>
              {postTransactionBalance}
            </Text>
          </View>
        )}
      </View>

      {status === 'pending' && (
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-3 rounded-xl items-center border border-border-primary"
            onPress={handleReject}
          >
            <Text className="text-text-tertiary font-semibold">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-3 rounded-xl items-center bg-brand-default"
            onPress={handleConfirm}
          >
            <Text className="text-white font-semibold">Confirm</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'confirming' && (
        <View className="flex-row items-center justify-center gap-2 py-2">
          <ActivityIndicator color={t.brand.default} />
          <Text className="text-text-tertiary text-sm">Processing...</Text>
        </View>
      )}

      {status === 'confirmed' && (
        <View className="items-center justify-center py-2">
          <Text className="text-status-success text-sm font-semibold">Confirmed</Text>
        </View>
      )}

      {status === 'rejected' && (
        <View className="items-center justify-center py-2">
          <Text className="text-text-tertiary text-sm font-semibold">Cancelled</Text>
        </View>
      )}

      {status === 'expired' && (
        <View className="items-center gap-2 py-3">
          <Text className="text-2xl">⏱</Text>
          <Text className="text-text-tertiary text-sm text-center leading-5">
            This action has expired. Ask the assistant to try again.
          </Text>
        </View>
      )}

      {status === 'error' && (
        <View className="items-center gap-3 py-2">
          <Text className="text-status-error text-sm">{errorMessage || 'Something went wrong'}</Text>
          <TouchableOpacity
            className="py-2.5 px-6 rounded-xl border border-brand-default"
            onPress={() => {
              setStatus('pending');
              setErrorMessage('');
            }}
          >
            <Text className="text-brand-default font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

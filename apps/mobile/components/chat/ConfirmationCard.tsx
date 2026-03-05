import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { confirmAction, rejectAction } from '../../lib/api';

interface ConfirmationCardProps {
  pendingActionId: string;
  summary: string;
  details: Record<string, string>;
  postTransactionBalance?: string;
  onConfirmed?: () => void;
  onRejected?: () => void;
}

export function ConfirmationCard({
  pendingActionId,
  summary,
  details,
  postTransactionBalance,
  onConfirmed,
  onRejected,
}: ConfirmationCardProps) {
  const [status, setStatus] = useState<'pending' | 'confirming' | 'confirmed' | 'rejected' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');

  const handleConfirm = async () => {
    setStatus('confirming');
    try {
      const result = await confirmAction(pendingActionId);
      if (result.success) {
        setStatus('confirmed');
        onConfirmed?.();
      } else {
        setStatus('error');
        const msg = result.message || 'Something went wrong';
        setErrorMessage(
          msg.includes('expired')
            ? 'This action has expired. Please ask the assistant to try again.'
            : msg
        );
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Failed to confirm');
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

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Confirm Action</Text>
      <Text style={styles.summary}>{summary}</Text>

      <View style={styles.details}>
        {Object.entries(details).map(([key, value]) => (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailKey}>{key}</Text>
            <Text style={styles.detailValue}>{value}</Text>
          </View>
        ))}
        {postTransactionBalance && (
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Balance after</Text>
            <Text style={[styles.detailValue, styles.balanceValue]}>{postTransactionBalance}</Text>
          </View>
        )}
      </View>

      {status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
            <Text style={styles.rejectText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'confirming' && (
        <View style={styles.statusRow}>
          <ActivityIndicator color="#6c5ce7" />
          <Text style={styles.statusText}>Processing...</Text>
        </View>
      )}

      {status === 'confirmed' && (
        <View style={styles.statusRow}>
          <Text style={styles.successText}>Confirmed</Text>
        </View>
      )}

      {status === 'rejected' && (
        <View style={styles.statusRow}>
          <Text style={styles.rejectedText}>Cancelled</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage || 'Something went wrong'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setStatus('pending');
              setErrorMessage('');
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  title: {
    color: '#6c5ce7',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  summary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  details: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  detailKey: { color: '#8b8ba7', fontSize: 14 },
  detailValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
  balanceValue: { color: '#8b8ba7' },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
  },
  rejectText: { color: '#8b8ba7', fontWeight: '600' },
  confirmText: { color: '#fff', fontWeight: '600' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  statusText: { color: '#8b8ba7', fontSize: 14 },
  successText: { color: '#2ecc71', fontSize: 14, fontWeight: '600' },
  rejectedText: { color: '#8b8ba7', fontSize: 14, fontWeight: '600' },
  errorText: { color: '#e74c3c', fontSize: 14 },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  retryText: { color: '#6c5ce7', fontWeight: '600', fontSize: 14 },
});

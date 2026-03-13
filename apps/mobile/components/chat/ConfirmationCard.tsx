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
  const cardStyle = isExpired
    ? [styles.card, styles.cardExpired]
    : styles.card;

  return (
    <View style={cardStyle}>
      <Text style={[styles.title, isExpired && styles.titleExpired]}>Confirm Action</Text>
      <Text style={[styles.summary, isExpired && styles.summaryExpired]}>{summary}</Text>

      <View style={styles.details}>
        {Object.entries(details).map(([key, value]) => (
          <View key={key} style={styles.detailRow}>
            <Text style={[styles.detailKey, isExpired && styles.textDimmed]}>{key}</Text>
            <Text style={[styles.detailValue, isExpired && styles.textDimmed]}>{value}</Text>
          </View>
        ))}
        {postTransactionBalance && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, isExpired && styles.textDimmed]}>Balance after</Text>
            <Text style={[styles.detailValue, styles.balanceValue, isExpired && styles.textDimmed]}>
              {postTransactionBalance}
            </Text>
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

      {status === 'expired' && (
        <View style={styles.expiredContainer}>
          <Text style={styles.expiredIcon}>⏱</Text>
          <Text style={styles.expiredText}>
            This action has expired. Ask the assistant to try again.
          </Text>
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
  cardExpired: {
    borderColor: '#3d3d55',
    opacity: 0.85,
  },
  title: {
    color: '#6c5ce7',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  titleExpired: {
    color: '#5a5a72',
  },
  summary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryExpired: {
    color: '#6b6b82',
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
  textDimmed: { color: '#4a4a5e' },
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
  expiredContainer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  expiredIcon: {
    fontSize: 24,
  },
  expiredText: {
    color: '#5a5a72',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
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

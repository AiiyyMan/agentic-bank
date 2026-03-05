import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ErrorCardProps {
  message: string;
  retryable: boolean;
  onRetry?: () => void;
}

export function ErrorCard({ message, retryable, onRetry }: ErrorCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Error</Text>
      <Text style={styles.message}>{message}</Text>
      {retryable && onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
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
    borderColor: '#e74c3c',
  },
  title: {
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  message: { color: '#fff', fontSize: 14, marginBottom: 12 },
  retryButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  retryText: { color: '#e74c3c', fontWeight: '600' },
});

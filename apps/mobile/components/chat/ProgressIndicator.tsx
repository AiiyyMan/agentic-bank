import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ProgressIndicatorProps {
  message?: string;
}

export function ProgressIndicator({ message = 'Thinking...' }: ProgressIndicatorProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#6c5ce7" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: {
    color: '#8b8ba7',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

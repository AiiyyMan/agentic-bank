import { View, Text, StyleSheet } from 'react-native';

interface DateGroupHeaderProps {
  date: string;
}

export function DateGroupHeader({ date }: DateGroupHeaderProps) {
  const formatted = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{formatted}</Text>
      <View style={styles.border} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  label: {
    color: '#8b8ba7',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  border: {
    height: 1,
    backgroundColor: '#2d2d44',
  },
});

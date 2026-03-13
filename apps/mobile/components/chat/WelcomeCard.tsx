import { View, Text } from 'react-native';

interface WelcomeCardProps {
  displayName: string;
  greeting: string;
}

export function WelcomeCard({ displayName, greeting }: WelcomeCardProps) {
  return (
    <View className="bg-brand-500/10 border border-brand-500/20 rounded-2xl p-5 my-2 mx-1">
      <Text className="text-brand-400 text-2xl font-bold mb-2">
        Welcome{displayName ? `, ${displayName}` : ''}!
      </Text>
      <Text className="text-text-secondary text-sm leading-5">{greeting}</Text>
    </View>
  );
}

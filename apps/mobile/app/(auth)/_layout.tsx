import { Stack } from 'expo-router';
import { useTokens } from '../../theme/tokens';

export default function AuthLayout() {
  const t = useTokens();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.background.primary },
      }}
    />
  );
}

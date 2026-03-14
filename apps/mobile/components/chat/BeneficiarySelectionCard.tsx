import { View, Text, TouchableOpacity } from 'react-native';

interface BeneficiaryOption {
  name: string;
  bank_name: string;
  account_number: string;
  sort_code: string;
  last_used_at: string | null;
}

interface BeneficiarySelectionCardProps {
  prompt: string;
  beneficiaries: BeneficiaryOption[];
  onSelect?: (message: string) => void;
}

function formatLastUsed(lastUsedAt: string | null): string {
  if (!lastUsedAt) return 'Never paid';
  const date = new Date(lastUsedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Paid today';
  if (diffDays === 1) return 'Paid yesterday';
  if (diffDays < 7) return `Paid ${diffDays} days ago`;
  if (diffDays < 30) return `Paid ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  if (diffDays < 365) return `Paid ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  return `Paid ${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
}

export function BeneficiarySelectionCard({
  prompt,
  beneficiaries,
  onSelect,
}: BeneficiarySelectionCardProps) {
  const handleSelect = (ben: BeneficiaryOption) => {
    // Send enough detail for the AI to re-resolve the UUID unambiguously
    onSelect?.(`${ben.name} at ${ben.bank_name} (${ben.account_number})`);
  };

  return (
    <View className="bg-surface-raised border border-border-default rounded-2xl p-4 my-2 mx-1">
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-3">
        <Text className="text-lg">👥</Text>
        <Text className="text-text-primary text-sm font-semibold flex-1">{prompt}</Text>
      </View>

      {/* Beneficiary options */}
      <View className="gap-2">
        {beneficiaries.map((ben, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handleSelect(ben)}
            className="bg-surface-primary border border-border-default rounded-xl p-3.5 active:opacity-70"
          >
            {/* Name + bank row */}
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-text-primary text-sm font-semibold">{ben.name}</Text>
              <View className="bg-brand-subtle px-2 py-0.5 rounded-full">
                <Text className="text-brand-default text-xs font-medium">{ben.bank_name}</Text>
              </View>
            </View>

            {/* Account details row */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Text className="text-text-tertiary text-xs">
                  {ben.sort_code}  ·  {ben.account_number}
                </Text>
              </View>
              <Text className="text-text-tertiary text-xs">{formatLastUsed(ben.last_used_at)}</Text>
            </View>

            {/* Select affordance */}
            <View className="mt-2 pt-2 border-t border-border-default flex-row items-center justify-end gap-1">
              <Text className="text-brand-default text-xs font-medium">Select</Text>
              <Text className="text-brand-default text-xs">→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

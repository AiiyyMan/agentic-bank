import { useState } from 'react';
import { View, Text, TouchableOpacity, Clipboard, Alert } from 'react-native';

interface AccountDetailsCardProps {
  accountName?: string;
  sortCode?: string;
  accountNumber?: string;
  iban?: string;
}

function CopyRow({ label, value, formatted }: { label: string; value: string; formatted?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TouchableOpacity
      onPress={handleCopy}
      className="flex-row items-center justify-between py-3 border-b border-border-default"
      accessibilityLabel={`Copy ${label}`}
      accessibilityRole="button"
    >
      <View>
        <Text className="text-text-tertiary text-xs mb-0.5">{label}</Text>
        <Text className="text-text-primary font-medium text-base">{formatted ?? value}</Text>
      </View>
      <View className={`px-3 py-1.5 rounded-lg ${copied ? 'bg-status-success-subtle' : 'bg-surface-raised'}`}>
        <Text className={`text-xs font-medium ${copied ? 'text-status-success-text' : 'text-brand-default'}`}>
          {copied ? '✓ Copied' : 'Copy'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function AccountDetailsCard({ accountName, sortCode, accountNumber, iban }: AccountDetailsCardProps) {
  const formattedSortCode = sortCode?.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');

  return (
    <View className="bg-surface-raised border border-border-default rounded-2xl p-4 my-2 mx-1">
      {accountName && (
        <Text className="text-text-primary font-semibold text-base mb-3">{accountName}</Text>
      )}

      {sortCode && (
        <CopyRow label="Sort Code" value={sortCode} formatted={formattedSortCode} />
      )}
      {accountNumber && (
        <CopyRow label="Account Number" value={accountNumber} />
      )}
      {iban && (
        <CopyRow label="IBAN" value={iban} />
      )}

      <Text className="text-text-tertiary text-xs mt-3">
        Tap any field to copy to clipboard
      </Text>
    </View>
  );
}

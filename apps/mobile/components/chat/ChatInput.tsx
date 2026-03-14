import { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTokens } from '../../theme/tokens';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = 'Message your bank...' }: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const t = useTokens();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View className="border-t border-border-default bg-background-primary px-3 py-3 flex-row items-end gap-2">
        <View className="flex-1 bg-surface-raised border border-border-default rounded-2xl px-4 py-2.5 min-h-[44px] justify-center">
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={t.text.tertiary}
            className="text-text-primary text-[15px] leading-5"
            multiline
            maxLength={500}
            returnKeyType="default"
            editable={!disabled}
            style={{ maxHeight: 120 }}
          />
        </View>

        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            canSend ? 'bg-brand-default' : 'bg-surface-raised'
          }`}
          style={{ marginBottom: 2 }}
        >
          <Text className={`text-lg ${canSend ? 'text-text-inverse' : 'text-text-disabled'}`}>
            ↑
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

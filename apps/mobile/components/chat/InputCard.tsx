import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useTokens } from '../../theme/tokens';

export interface InputField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'date' | 'number';
  required?: boolean;
}

interface InputCardProps {
  title?: string;
  subtitle?: string;
  fields: InputField[];
  submitLabel?: string;
  onSubmit?: (values: Record<string, string>) => void;
}

export function InputCard({ title, subtitle, fields, submitLabel = 'Submit', onSubmit }: InputCardProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const t = useTokens();

  const handleSubmit = () => {
    if (submitted) return;

    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required && !values[field.key]?.trim()) {
        newErrors[field.key] = `${field.label} is required`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitted(true);
    onSubmit?.(values);
  };

  const getKeyboardType = (type?: string) => {
    switch (type) {
      case 'email': return 'email-address';
      case 'number': return 'numeric';
      default: return 'default';
    }
  };

  return (
    <View className="bg-surface-raised border border-border-default rounded-2xl p-4 my-2 mx-1">
      {title && (
        <Text className="text-text-primary font-semibold text-base mb-1">{title}</Text>
      )}
      {subtitle && (
        <Text className="text-text-secondary text-sm mb-3">{subtitle}</Text>
      )}

      <View className="gap-3">
        {fields.map((field) => (
          <View key={field.key}>
            <Text className="text-text-secondary text-xs mb-1.5 font-medium">{field.label}</Text>
            <TextInput
              value={values[field.key] ?? ''}
              onChangeText={(v) => {
                setValues((prev) => ({ ...prev, [field.key]: v }));
                if (errors[field.key]) {
                  setErrors((prev) => { const e = { ...prev }; delete e[field.key]; return e; });
                }
              }}
              placeholder={field.placeholder}
              placeholderTextColor={t.text.tertiary}
              secureTextEntry={field.type === 'password'}
              keyboardType={getKeyboardType(field.type)}
              autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
              editable={!submitted}
              className="bg-background-secondary border border-border-default rounded-xl px-4 py-3 text-text-primary text-[15px]"
              style={{ borderColor: errors[field.key] ? t.border.error : undefined }}
            />
            {errors[field.key] && (
              <Text className="text-status-error-text text-xs mt-1">{errors[field.key]}</Text>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitted}
        className={`mt-4 py-3 rounded-xl items-center ${submitted ? 'bg-surface-raised border border-border-default' : 'bg-brand-default'}`}
      >
        <Text className={`font-semibold text-[15px] ${submitted ? 'text-text-tertiary' : 'text-text-inverse'}`}>
          {submitted ? '✓ Submitted' : submitLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTokens } from '../../theme/tokens';

interface DatePickerCardProps {
  title: string;
  subtitle?: string;
  minDate?: string;  // ISO date string YYYY-MM-DD
  maxDate?: string;  // ISO date string YYYY-MM-DD
  onSelect?: (date: string) => void;
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateOnly(isoString: string): Date {
  const [y, m, d] = isoString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DatePickerCard({
  title,
  subtitle,
  minDate,
  maxDate,
  onSelect,
}: DatePickerCardProps) {
  const t = useTokens();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const minDateObj = minDate ? toDateOnly(minDate) : null;
  const maxDateObj = maxDate ? toDateOnly(maxDate) : null;

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build the day grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayPress = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    if (isDisabled(day)) return;
    setSelectedDate(date);
    onSelect?.(formatISO(date));
  };

  const isDisabled = (day: number): boolean => {
    const date = new Date(viewYear, viewMonth, day);
    if (minDateObj && date < minDateObj) return true;
    if (maxDateObj && date > maxDateObj) return true;
    return false;
  };

  const isToday = (day: number): boolean => {
    const date = new Date(viewYear, viewMonth, day);
    return isSameDay(date, today);
  };

  const isSelected = (day: number): boolean => {
    if (!selectedDate) return false;
    const date = new Date(viewYear, viewMonth, day);
    return isSameDay(date, selectedDate);
  };

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <Text style={{ color: t.brand.default }} className="text-xs font-semibold uppercase mb-1">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-text-tertiary text-sm mb-3">{subtitle}</Text>
      ) : null}

      {/* Month/Year navigation */}
      <View className="flex-row items-center justify-between mt-2 mb-3">
        <TouchableOpacity
          onPress={goToPrevMonth}
          className="w-9 h-9 rounded-full bg-surface-secondary items-center justify-center"
        >
          <Text style={{ color: t.brand.default }} className="text-xl font-semibold leading-6">‹</Text>
        </TouchableOpacity>
        <Text className="text-text-primary text-base font-semibold">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity
          onPress={goToNextMonth}
          className="w-9 h-9 rounded-full bg-surface-secondary items-center justify-center"
        >
          <Text style={{ color: t.brand.default }} className="text-xl font-semibold leading-6">›</Text>
        </TouchableOpacity>
      </View>

      {/* Days of week header */}
      <View className="flex-row mb-1">
        {DAYS_OF_WEEK.map((day) => (
          <View key={day} style={{ flex: 1 }} className="items-center py-1">
            <Text className="text-text-tertiary text-xs font-medium">{day}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View className="flex-row flex-wrap">
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          }
          const disabled = isDisabled(day);
          const todayDay = isToday(day);
          const selected = isSelected(day);

          return (
            <TouchableOpacity
              key={`day-${day}`}
              style={[
                { width: `${100 / 7}%`, aspectRatio: 1 },
                selected && { backgroundColor: t.brand.default },
                todayDay && !selected && { borderWidth: 1, borderColor: t.brand.default },
                disabled && { opacity: 0.3 },
              ]}
              className="items-center justify-center rounded-full"
              onPress={() => handleDayPress(day)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  { color: todayDay && !selected ? t.brand.default : t.text.primary },
                  selected && { color: t.text.inverse },
                ]}
                className="text-sm"
              >
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedDate ? (
        <Text style={{ color: t.brand.muted }} className="text-xs text-center mt-3 font-medium">
          Selected:{' '}
          {selectedDate.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
      ) : null}
    </View>
  );
}

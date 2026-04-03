import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../utils/theme';

// ISO weekdays: 1=Mon … 7=Sun
const DAYS = [
  { label: 'M', value: 1, full: 'Mon' },
  { label: 'T', value: 2, full: 'Tue' },
  { label: 'W', value: 3, full: 'Wed' },
  { label: 'T', value: 4, full: 'Thu' },
  { label: 'F', value: 5, full: 'Fri' },
  { label: 'S', value: 6, full: 'Sat' },
  { label: 'S', value: 7, full: 'Sun' },
];

interface Props {
  value: number[];          // selected ISO weekday numbers
  onChange: (days: number[]) => void;
  color?: string;
}

export default function DayOfWeekPicker({ value, onChange, color = colors.accent }: Props) {
  const toggle = (day: number) => {
    if (value.includes(day)) {
      // don't allow deselecting all
      if (value.length === 1) return;
      onChange(value.filter(d => d !== day));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  const allSelected = value.length === 7;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {DAYS.map(d => {
          const active = value.includes(d.value);
          return (
            <TouchableOpacity
              key={d.value}
              style={[styles.dayBtn, active && { backgroundColor: color, borderColor: color }]}
              onPress={() => toggle(d.value)}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        onPress={() => onChange(allSelected ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7])}
      >
        <Text style={styles.toggle}>
          {allSelected ? 'Weekdays only' : 'Select all'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function daysToString(days: number[]): string | null {
  if (days.length === 7) return null; // null = every day
  return days.join(',');
}

export function stringToDays(s: string | null): number[] {
  if (!s) return [1, 2, 3, 4, 5, 6, 7];
  return s.split(',').map(Number);
}

export function daysLabel(s: string | null): string {
  if (!s) return 'Every day';
  const days = s.split(',').map(Number);
  if (days.length === 5 && !days.includes(6) && !days.includes(7)) return 'Weekdays';
  if (days.length === 2 && days.includes(6) && days.includes(7)) return 'Weekends';
  return days.map(d => DAYS.find(x => x.value === d)?.full ?? '').join(', ');
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayLabelActive: {
    color: '#000',
  },
  toggle: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
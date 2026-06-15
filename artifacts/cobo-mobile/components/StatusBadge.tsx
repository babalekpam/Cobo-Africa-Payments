import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type Status = 'pending' | 'completed' | 'failed' | 'cancelled';

interface StatusBadgeProps {
  status: Status;
}

const STATUS_CONFIG: Record<
  Status,
  { label: string; bg: string; text: string }
> = {
  pending: { label: 'Pending', bg: Colors.warningLight, text: Colors.warning },
  completed: { label: 'Completed', bg: Colors.successLight, text: Colors.success },
  failed: { label: 'Failed', bg: Colors.errorLight, text: Colors.error },
  cancelled: { label: 'Cancelled', bg: '#f1f5f9', text: Colors.textMuted },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});

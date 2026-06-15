import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Transaction } from '../services/api';
import { StatusBadge } from './StatusBadge';
import { getCurrencyByCode } from '../constants/currencies';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: () => void;
}

function getTransactionIcon(type: Transaction['type']) {
  switch (type) {
    case 'send':
      return { name: 'arrow-up-circle' as const, color: Colors.error };
    case 'receive':
      return { name: 'arrow-down-circle' as const, color: Colors.success };
    case 'exchange':
      return { name: 'swap-horizontal' as const, color: Colors.warning };
    case 'deposit':
      return { name: 'add-circle' as const, color: Colors.success };
    case 'withdrawal':
      return { name: 'remove-circle' as const, color: Colors.error };
    default:
      return { name: 'ellipse' as const, color: Colors.textMuted };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export function TransactionItem({ transaction, onPress }: TransactionItemProps) {
  const icon = getTransactionIcon(transaction.type);
  const currencyInfo = getCurrencyByCode(transaction.currency);
  const symbol = currencyInfo?.symbol || transaction.currency;
  const isCredit = transaction.type === 'receive' || transaction.type === 'deposit';
  const amountSign = isCredit ? '+' : '-';
  const amountColor = isCredit ? Colors.success : Colors.error;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(transaction.amount);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
        <Ionicons name={icon.name} size={24} color={icon.color} />
      </View>

      <View style={styles.details}>
        <Text style={styles.description} numberOfLines={1}>
          {transaction.description}
        </Text>
        <View style={styles.metaRow}>
          <StatusBadge status={transaction.status} />
          <Text style={styles.date}>{formatDate(transaction.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {amountSign}{symbol} {formatted}
        </Text>
        {transaction.fee !== undefined && transaction.fee > 0 && (
          <Text style={styles.fee}>Fee: {symbol} {transaction.fee.toFixed(2)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  details: {
    flex: 1,
    marginRight: 8,
  },
  description: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  fee: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

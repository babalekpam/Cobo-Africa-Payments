import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import { getCurrencyByCode, formatBalance } from '../constants/currencies';

interface WalletCardProps {
  currency: string;
  balance: number;
  isDefault: boolean;
  onSetDefault?: () => void;
}

export function WalletCard({
  currency,
  balance,
  isDefault,
  onSetDefault,
}: WalletCardProps) {
  const currencyInfo = getCurrencyByCode(currency);
  const flag = currencyInfo?.flag || '💰';
  const name = currencyInfo?.name || currency;

  return (
    <LinearGradient
      colors={isDefault ? ['#C98A1A', '#A67015'] : ['#0F2B4C', '#143A5C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.currencyInfo}>
          <Text style={styles.flag}>{flag}</Text>
          <View>
            <Text style={styles.currencyCode}>{currency}</Text>
            <Text style={styles.currencyName}>{name}</Text>
          </View>
        </View>
        {isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultText}>Default</Text>
          </View>
        )}
      </View>

      <Text style={styles.balance}>{formatBalance(balance, currency)}</Text>

      {!isDefault && onSetDefault && (
        <TouchableOpacity style={styles.setDefaultBtn} onPress={onSetDefault}>
          <Text style={styles.setDefaultText}>Set as Default</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flag: {
    fontSize: 28,
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  currencyName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  defaultBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  balance: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  setDefaultBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  setDefaultText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
});

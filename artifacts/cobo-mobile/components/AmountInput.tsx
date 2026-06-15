import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { CURRENCIES, Currency } from '../constants/currencies';

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  label?: string;
  placeholder?: string;
  editable?: boolean;
  availableCurrencies?: string[];
}

export function AmountInput({
  value,
  onChangeText,
  selectedCurrency,
  onCurrencyChange,
  label = 'Amount',
  placeholder = '0.00',
  editable = true,
  availableCurrencies,
}: AmountInputProps) {
  const [showPicker, setShowPicker] = useState(false);

  const currencies = availableCurrencies
    ? CURRENCIES.filter((c) => availableCurrencies.includes(c.code))
    : CURRENCIES;

  const selected = CURRENCIES.find((c) => c.code === selectedCurrency);

  const handleTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length <= 2) {
      if (parts[1] && parts[1].length > 2) return;
      onChangeText(cleaned);
    }
  };

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.currencySelector}
          onPress={() => setShowPicker(true)}
        >
          <Text style={styles.flag}>{selected?.flag || '💱'}</Text>
          <Text style={styles.currencyCode}>{selectedCurrency}</Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          keyboardType="decimal-pad"
          editable={editable}
        />
      </View>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={currencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }: { item: Currency }) => (
                <TouchableOpacity
                  style={[
                    styles.currencyItem,
                    item.code === selectedCurrency && styles.currencyItemSelected,
                  ]}
                  onPress={() => {
                    onCurrencyChange(item.code);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.itemFlag}>{item.flag}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemCode}>{item.code}</Text>
                    <Text style={styles.itemName}>{item.name}</Text>
                  </View>
                  {item.code === selectedCurrency && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    overflow: 'hidden',
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.white,
  },
  flag: {
    fontSize: 18,
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  inputDisabled: {
    color: Colors.textMuted,
    backgroundColor: Colors.borderLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  currencyItemSelected: {
    backgroundColor: '#fef9f0',
  },
  itemFlag: {
    fontSize: 22,
  },
  itemInfo: {
    flex: 1,
  },
  itemCode: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  itemName: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
});

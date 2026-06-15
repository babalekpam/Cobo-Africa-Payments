import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { api, Wallet, TransferResponse, ExchangeRate } from '../../services/api';
import { useWallets } from '../../hooks/useWallets';
import { AmountInput } from '../../components/AmountInput';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { COUNTRIES, MOBILE_PROVIDERS, formatBalance } from '../../constants/currencies';

type Tab = 'mobile' | 'bank' | 'cobo';

interface DropdownOption {
  label: string;
  value: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SelectButton({
  value,
  placeholder,
  onPress,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.selectBtn} onPress={onPress}>
      <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function SimpleDropdown({
  visible,
  options,
  onSelect,
  onClose,
  title,
}: {
  visible: boolean;
  options: DropdownOption[];
  onSelect: (val: string) => void;
  onClose: () => void;
  title: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { onSelect(item.value); onClose(); }}
              >
                <Text style={styles.dropdownItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function SendScreen() {
  const { wallets } = useWallets();
  const [activeTab, setActiveTab] = useState<Tab>('mobile');

  // Shared
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');

  // Mobile money
  const [recipientCountry, setRecipientCountry] = useState('');
  const [mobileProvider, setMobileProvider] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');

  // Bank
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankCountry, setBankCountry] = useState('');

  // COBO
  const [recipientEmail, setRecipientEmail] = useState('');
  const [note, setNote] = useState('');

  // State
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  const selectedWallet = wallets.find((w) => w.id === sourceWalletId) || wallets.find((w) => w.isDefault);

  const providers = recipientCountry
    ? (MOBILE_PROVIDERS[recipientCountry] || []).map((p) => ({ label: p, value: p }))
    : [];

  const walletOptions: DropdownOption[] = wallets.map((w) => ({
    label: `${w.currency} — ${formatBalance(w.balance, w.currency)}`,
    value: w.id,
  }));

  const countryOptions: DropdownOption[] = COUNTRIES.map((c) => ({
    label: `${c.flag} ${c.name}`,
    value: c.code,
  }));

  const fee = parseFloat(amount || '0') * 0.015;

  const validateMobile = (): string | null => {
    if (!selectedWallet) return 'Select a source wallet';
    if (!amount || parseFloat(amount) <= 0) return 'Enter a valid amount';
    if (parseFloat(amount) > selectedWallet.balance) return 'Insufficient balance';
    if (!recipientCountry) return 'Select recipient country';
    if (!mobileProvider) return 'Select mobile provider';
    if (!phoneNumber.trim()) return 'Enter phone number';
    if (!recipientName.trim()) return 'Enter recipient name';
    return null;
  };

  const validateBank = (): string | null => {
    if (!selectedWallet) return 'Select a source wallet';
    if (!amount || parseFloat(amount) <= 0) return 'Enter a valid amount';
    if (parseFloat(amount) > selectedWallet.balance) return 'Insufficient balance';
    if (!bankCountry) return 'Select destination country';
    if (!bankName.trim()) return 'Enter bank name';
    if (!accountNumber.trim()) return 'Enter account number';
    if (!accountName.trim()) return 'Enter account name';
    return null;
  };

  const validateCobo = (): string | null => {
    if (!selectedWallet) return 'Select a source wallet';
    if (!amount || parseFloat(amount) <= 0) return 'Enter a valid amount';
    if (parseFloat(amount) > selectedWallet.balance) return 'Insufficient balance';
    if (!recipientEmail.trim()) return 'Enter recipient email';
    if (!/\S+@\S+\.\S+/.test(recipientEmail)) return 'Enter a valid email';
    return null;
  };

  const handleSend = async () => {
    setError('');
    let validationError: string | null = null;
    if (activeTab === 'mobile') validationError = validateMobile();
    else if (activeTab === 'bank') validationError = validateBank();
    else validationError = validateCobo();

    if (validationError) { setError(validationError); return; }
    setShowConfirm(true);
  };

  const confirmSend = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setError('');

    try {
      let response: TransferResponse;

      if (activeTab === 'mobile') {
        response = await api.post<TransferResponse>('/api/transfers/mobile', {
          walletId: selectedWallet!.id,
          amount: parseFloat(amount),
          currency: selectedWallet!.currency,
          country: recipientCountry,
          provider: mobileProvider,
          phoneNumber,
          recipientName,
        });
      } else if (activeTab === 'bank') {
        response = await api.post<TransferResponse>('/api/transfers/bank', {
          walletId: selectedWallet!.id,
          amount: parseFloat(amount),
          currency: selectedWallet!.currency,
          country: bankCountry,
          bankName,
          accountNumber,
          accountName,
        });
      } else {
        response = await api.post<TransferResponse>('/api/transfers/internal', {
          walletId: selectedWallet!.id,
          amount: parseFloat(amount),
          currency: selectedWallet!.currency,
          recipientEmail: recipientEmail.trim().toLowerCase(),
          note,
        });
      }

      setSuccess(`Transfer successful! Reference: ${response.reference}`);
      setAmount('');
      setPhoneNumber('');
      setRecipientName('');
      setRecipientEmail('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (wallets.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Send Money</Text>
        </View>
        <View style={styles.noWalletsState}>
          <Ionicons name="wallet-outline" size={52} color={Colors.border} />
          <Text style={styles.noWalletsTitle}>No wallets found</Text>
          <Text style={styles.noWalletsSub}>
            Please add a wallet before sending money
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Send Money</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(['mobile', 'bank', 'cobo'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab === 'mobile' ? 'Mobile' : tab === 'bank' ? 'Bank' : 'COBO'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {success ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Source Wallet */}
          <Field label="From Wallet">
            <SelectButton
              value={selectedWallet ? `${selectedWallet.currency} — ${formatBalance(selectedWallet.balance, selectedWallet.currency)}` : ''}
              placeholder="Select wallet"
              onPress={() => setShowWalletPicker(true)}
            />
          </Field>

          {/* Amount */}
          <AmountInput
            label="Amount"
            value={amount}
            onChangeText={(t) => { setAmount(t); setError(''); setSuccess(''); }}
            selectedCurrency={selectedWallet?.currency || 'USD'}
            onCurrencyChange={() => {}}
            availableCurrencies={selectedWallet ? [selectedWallet.currency] : ['USD']}
          />

          {parseFloat(amount) > 0 && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Transaction fee (1.5%):</Text>
              <Text style={styles.feeValue}>{selectedWallet?.currency || 'USD'} {fee.toFixed(2)}</Text>
            </View>
          )}

          {/* Mobile Money Form */}
          {activeTab === 'mobile' && (
            <>
              <Field label="Recipient Country">
                <SelectButton
                  value={COUNTRIES.find((c) => c.code === recipientCountry)?.name || ''}
                  placeholder="Select country"
                  onPress={() => setShowCountryPicker(true)}
                />
              </Field>

              <Field label="Mobile Provider">
                <SelectButton
                  value={mobileProvider}
                  placeholder={recipientCountry ? 'Select provider' : 'Select country first'}
                  onPress={() => providers.length > 0 && setShowProviderPicker(true)}
                />
              </Field>

              <Field label="Phone Number">
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={phoneNumber}
                    onChangeText={(t) => setPhoneNumber(t.replace(/\D/g, ''))}
                    placeholder="700 000 0000"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="phone-pad"
                  />
                </View>
              </Field>

              <Field label="Recipient Name">
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={recipientName}
                    onChangeText={setRecipientName}
                    placeholder="Full name"
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </Field>
            </>
          )}

          {/* Bank Transfer Form */}
          {activeTab === 'bank' && (
            <>
              <Field label="Destination Country">
                <SelectButton
                  value={COUNTRIES.find((c) => c.code === bankCountry)?.name || ''}
                  placeholder="Select country"
                  onPress={() => setShowCountryPicker(true)}
                />
              </Field>

              <Field label="Bank Name">
                <View style={styles.inputWrapper}>
                  <Ionicons name="business-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="e.g. GTBank, Equity Bank"
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </Field>

              <Field label="Account Number / IBAN">
                <View style={styles.inputWrapper}>
                  <Ionicons name="card-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={accountNumber}
                    onChangeText={(t) => setAccountNumber(t.replace(/\s/g, ''))}
                    placeholder="Account or IBAN number"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="default"
                  />
                </View>
              </Field>

              <Field label="Account Name">
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={accountName}
                    onChangeText={setAccountName}
                    placeholder="Beneficiary name"
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </Field>
            </>
          )}

          {/* COBO-to-COBO Form */}
          {activeTab === 'cobo' && (
            <>
              <Field label="Recipient Email">
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={recipientEmail}
                    onChangeText={(t) => { setRecipientEmail(t); setError(''); }}
                    placeholder="recipient@example.com"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </Field>

              <Field label="Note (Optional)">
                <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Add a message..."
                    placeholderTextColor={Colors.textLight}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </Field>
            </>
          )}

          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={isSubmitting}
            activeOpacity={0.85}
            style={styles.sendBtnWrapper}
          >
            {isSubmitting ? (
              <View style={styles.sendBtn}>
                <LoadingSpinner size="small" />
                <Text style={styles.sendBtnText}>Processing...</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#C98A1A', '#A67015']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendBtn}
              >
                <Ionicons name="paper-plane" size={18} color={Colors.white} />
                <Text style={styles.sendBtnText}>
                  {activeTab === 'cobo' ? 'Send to COBO User' : activeTab === 'bank' ? 'Send to Bank' : 'Send via Mobile Money'}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Wallet Picker */}
      <SimpleDropdown
        visible={showWalletPicker}
        options={walletOptions}
        onSelect={(v) => { setSourceWalletId(v); setCurrency(wallets.find((w) => w.id === v)?.currency || 'USD'); }}
        onClose={() => setShowWalletPicker(false)}
        title="Select Source Wallet"
      />

      {/* Country Picker */}
      <SimpleDropdown
        visible={showCountryPicker}
        options={countryOptions}
        onSelect={(v) => {
          if (activeTab === 'mobile') { setRecipientCountry(v); setMobileProvider(''); }
          else setBankCountry(v);
        }}
        onClose={() => setShowCountryPicker(false)}
        title="Select Country"
      />

      {/* Provider Picker */}
      <SimpleDropdown
        visible={showProviderPicker}
        options={providers}
        onSelect={setMobileProvider}
        onClose={() => setShowProviderPicker(false)}
        title="Select Mobile Provider"
      />

      {/* Confirmation Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="paper-plane" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.confirmTitle}>Confirm Transfer</Text>

            <View style={styles.confirmDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Amount</Text>
                <Text style={styles.confirmValue}>
                  {selectedWallet?.currency} {parseFloat(amount || '0').toFixed(2)}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Fee (1.5%)</Text>
                <Text style={styles.confirmValue}>
                  {selectedWallet?.currency} {fee.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.confirmRow, styles.confirmTotal]}>
                <Text style={styles.confirmKey}>Total</Text>
                <Text style={[styles.confirmValue, styles.confirmTotalAmount]}>
                  {selectedWallet?.currency} {(parseFloat(amount || '0') + fee).toFixed(2)}
                </Text>
              </View>

              {activeTab === 'mobile' && (
                <>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmKey}>To</Text>
                    <Text style={styles.confirmValue}>{recipientName}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmKey}>Phone</Text>
                    <Text style={styles.confirmValue}>{phoneNumber}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmKey}>Via</Text>
                    <Text style={styles.confirmValue}>{mobileProvider}</Text>
                  </View>
                </>
              )}
              {activeTab === 'cobo' && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmKey}>To</Text>
                  <Text style={styles.confirmValue}>{recipientEmail}</Text>
                </View>
              )}
              {activeTab === 'bank' && (
                <>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmKey}>Bank</Text>
                    <Text style={styles.confirmValue}>{bankName}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmKey}>Account</Text>
                    <Text style={styles.confirmValue}>{accountName}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmSend} style={styles.confirmBtnWrapper}>
                <LinearGradient
                  colors={['#C98A1A', '#A67015']}
                  style={styles.confirmBtn}
                >
                  <Text style={styles.confirmBtnText}>Confirm Send</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  tabItemActive: { backgroundColor: Colors.primary },
  tabLabel: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  tabLabelActive: { color: Colors.white, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: { flex: 1, fontSize: 13, color: Colors.success },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  selectBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: Colors.inputBackground,
  },
  selectText: { fontSize: 14, color: Colors.text },
  selectPlaceholder: { color: Colors.textLight },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
  },
  inputIcon: { marginLeft: 12 },
  textInput: { flex: 1, paddingVertical: 13, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  textAreaWrapper: { alignItems: 'flex-start' },
  textArea: { minHeight: 80, paddingTop: 12 },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  feeLabel: { fontSize: 13, color: Colors.textMuted },
  feeValue: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  sendBtnWrapper: { marginTop: 8 },
  sendBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 16,
  },
  sendBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  dropdownContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemText: { fontSize: 14, color: Colors.text },
  noWalletsState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  noWalletsTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginTop: 12 },
  noWalletsSub: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  confirmOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fef9f0',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmDetails: {
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  confirmKey: { fontSize: 13, color: Colors.textMuted },
  confirmValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  confirmTotalAmount: { fontWeight: '700', color: Colors.primary, fontSize: 15 },
  confirmActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  confirmBtnWrapper: { flex: 1 },
  confirmBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 14, color: Colors.white, fontWeight: '700' },
});

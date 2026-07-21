import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { authService } from '../../services/auth';
import { COUNTRIES } from '../../constants/currencies';

type Country = { code: string; name: string; flag: string; dialCode: string };

function FormField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  required = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, secureTextEntry && styles.inputWithTrail]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !show}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {secureTextEntry && (
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShow((v) => !v)}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [businessName, setBusinessName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const validate = (): string | null => {
    if (!firstName.trim()) return 'First name is required';
    if (!lastName.trim()) return 'Last name is required';
    if (!email.trim()) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Enter a valid email address';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    if (!acceptedTerms) return 'You must accept the Terms of Service';
    return null;
  };

  const handleRegister = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      await authService.register({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone ? `${selectedCountry.dialCode}${phone.replace(/^0/, '')}` : undefined,
        country: selectedCountry.code,
        businessName: businessName.trim() || undefined,
      });

      router.replace('/(auth)/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.backButton}>
                <Ionicons name="arrow-back" size={22} color={Colors.text} />
              </TouchableOpacity>
            </Link>
            <View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join IAPAY today</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            {/* Name row */}
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <FormField
                  label="First Name"
                  icon="person-outline"
                  value={firstName}
                  onChangeText={(t) => { setFirstName(t); setError(''); }}
                  placeholder="John"
                  autoCapitalize="words"
                  required
                />
              </View>
              <View style={styles.nameField}>
                <FormField
                  label="Last Name"
                  icon="person-outline"
                  value={lastName}
                  onChangeText={(t) => { setLastName(t); setError(''); }}
                  placeholder="Doe"
                  autoCapitalize="words"
                  required
                />
              </View>
            </View>

            <FormField
              label="Email Address"
              icon="mail-outline"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              required
            />

            <FormField
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              placeholder="Min. 8 characters"
              secureTextEntry
              required
            />

            <FormField
              label="Confirm Password"
              icon="lock-closed-outline"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
              placeholder="Repeat your password"
              secureTextEntry
              required
            />

            {/* Country */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Country <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryName}>{selectedCountry.name}</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={styles.dialCodeSelector}
                  onPress={() => setShowCountryPicker(true)}
                >
                  <Text style={styles.dialFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
                  <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
                  placeholder="800 000 0000"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <FormField
              label="Business Name (Optional)"
              icon="business-outline"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your company name"
              autoCapitalize="words"
            />

            {/* Terms */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAcceptedTerms((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={14} color={Colors.white} />}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
            style={styles.submitWrapper}
          >
            <LinearGradient
              colors={isLoading ? ['#ccc', '#bbb'] : ['#C98A1A', '#A67015']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.registerBtn}
            >
              <Text style={styles.registerBtnText}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Text>
              {!isLoading && <Ionicons name="arrow-forward" size={18} color={Colors.white} />}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.loginLink}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Search country..."
                placeholderTextColor={Colors.textLight}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }: { item: Country }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    item.code === selectedCountry.code && styles.countryItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <Text style={styles.countryItemName}>{item.name}</Text>
                  <Text style={styles.countryItemDial}>{item.dialCode}</Text>
                  {item.code === selectedCountry.code && (
                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
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
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  nameRow: { flexDirection: 'row', gap: 12 },
  nameField: { flex: 1 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  required: { color: Colors.error },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
  },
  inputIcon: { marginLeft: 12 },
  input: { flex: 1, paddingVertical: 13, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  inputWithTrail: { paddingRight: 0 },
  eyeBtn: { padding: 12 },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  countryFlag: { fontSize: 20 },
  countryName: { flex: 1, fontSize: 14, color: Colors.text },
  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    overflow: 'hidden',
  },
  dialCodeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.white,
  },
  dialFlag: { fontSize: 16 },
  dialCode: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  phoneInput: { flex: 1, paddingVertical: 13, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { flex: 1, fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  termsLink: { color: Colors.primary, fontWeight: '500' },
  submitWrapper: { marginTop: 20 },
  registerBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 15,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  loginText: { color: Colors.textMuted, fontSize: 14 },
  loginLink: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
  },
  searchIcon: { marginLeft: 10 },
  searchInput: { flex: 1, padding: 10, fontSize: 14, color: Colors.text },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 10,
  },
  countryItemSelected: { backgroundColor: '#fef9f0' },
  countryItemFlag: { fontSize: 22, width: 30 },
  countryItemName: { flex: 1, fontSize: 14, color: Colors.text },
  countryItemDial: { fontSize: 13, color: Colors.textMuted },
});

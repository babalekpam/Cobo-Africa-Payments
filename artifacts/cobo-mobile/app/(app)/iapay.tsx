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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';

type Tab = 'pay' | 'keys';

interface AliasRow {
  id: number;
  aliasType: string;
  aliasValue: string;
  currency: string;
  status: string;
}

interface ResolvedKey {
  holder_name: string;
  alias_type: string;
  currency: string;
  institution: { code: string; name: string; country: string };
}

// Fresh idempotency key per payment attempt (RN doesn't guarantee crypto.randomUUID)
function newIdemKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

const KEY_TYPES = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'random', label: 'Random' },
];

export default function IAPAYScreen() {
  const [tab, setTab] = useState<Tab>('pay');

  // Pay
  const [payKey, setPayKey] = useState('');
  const [resolved, setResolved] = useState<ResolvedKey | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [idemKey, setIdemKey] = useState(newIdemKey());

  // Keys
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [newKeyType, setNewKeyType] = useState('phone');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [verifyCodes, setVerifyCodes] = useState<Record<number, string>>({});

  const loadAliases = useCallback(async () => {
    try {
      const data = await api.get<{ aliases: AliasRow[] }>('/api/scheme/aliases');
      setAliases(data.aliases || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadAliases();
  }, [loadAliases]);

  async function lookup() {
    if (!payKey.trim()) return;
    setLoading(true);
    setResolved(null);
    try {
      const data = await api.get<ResolvedKey>(`/api/scheme/resolve?key=${encodeURIComponent(payKey.trim())}`);
      setResolved(data);
      setIdemKey(newIdemKey());
    } catch (e: any) {
      Alert.alert('Not found', e.message || 'IAPAY key not found in the network directory');
    } finally {
      setLoading(false);
    }
  }

  async function pay() {
    if (!resolved || !amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      const data = await api.post<{
        reference: string;
        recipient_amount: number;
        recipient_currency: string;
        recipient_name: string;
      }>('/api/scheme/pay', {
        key: payKey.trim(),
        amount,
        description: note || undefined,
        idempotency_key: idemKey,
      });
      Alert.alert(
        'Sent instantly ⚡',
        `${data.recipient_currency} ${Number(data.recipient_amount).toFixed(2)} delivered to ${data.recipient_name}\nRef: ${data.reference}`,
      );
      setPayKey('');
      setAmount('');
      setNote('');
      setResolved(null);
    } catch (e: any) {
      Alert.alert('Payment failed', e.message || 'Something went wrong');
    } finally {
      setIdemKey(newIdemKey());
      setLoading(false);
    }
  }

  async function registerKey() {
    try {
      const data = await api.post<{ message: string; dev_code?: string }>('/api/scheme/aliases', {
        alias_type: newKeyType,
        alias_value: newKeyValue,
        currency: 'USD',
      });
      Alert.alert('Key registered', data.dev_code ? `${data.message}\nSandbox code: ${data.dev_code}` : data.message);
      setNewKeyValue('');
      loadAliases();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not register key');
    }
  }

  async function verifyKey(id: number) {
    try {
      const data = await api.post<{ message: string }>(`/api/scheme/aliases/${id}/verify`, {
        code: verifyCodes[id] || '',
      });
      Alert.alert('IAPAY', data.message);
      loadAliases();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Verification failed');
    }
  }

  async function removeKey(id: number) {
    try {
      await api.delete(`/api/scheme/aliases/${id}`);
      loadAliases();
    } catch {
      // ignore
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>⚡ IAPAY</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Instant · 24/7 · Free</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Pay any IAPAY key across the pan-African network — phone, email or ID.
          </Text>

          <View style={styles.tabRow}>
            {(
              [
                ['pay', 'Pay a key'],
                ['keys', 'My keys'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <TouchableOpacity
                key={id}
                style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
                onPress={() => setTab(id)}
              >
                <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'pay' && (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>IAPAY key</Text>
              <View style={styles.lookupRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Phone, email or national ID"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  value={payKey}
                  onChangeText={setPayKey}
                />
                <TouchableOpacity style={styles.lookupBtn} onPress={lookup} disabled={loading}>
                  <Ionicons name="search" size={18} color={Colors.white} />
                </TouchableOpacity>
              </View>

              {resolved && (
                <View style={styles.resolvedBox}>
                  <Text style={styles.resolvedName}>{resolved.holder_name}</Text>
                  <Text style={styles.resolvedMeta}>
                    {resolved.institution.name} · {resolved.institution.country} · receives {resolved.currency}
                  </Text>
                </View>
              )}

              {resolved && (
                <>
                  <Text style={styles.fieldLabel}>Amount</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                  <Text style={styles.fieldLabel}>Note (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="What's it for?"
                    placeholderTextColor={Colors.textMuted}
                    value={note}
                    onChangeText={setNote}
                  />
                  <TouchableOpacity
                    style={[styles.payBtn, (!amount || loading) && styles.payBtnDisabled]}
                    onPress={pay}
                    disabled={!amount || loading}
                  >
                    {loading ? (
                      <LoadingSpinner size="small" />
                    ) : (
                      <Text style={styles.payBtnText}>Send instantly — no fee</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {tab === 'keys' && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Register a key ({aliases.length}/5)</Text>
                <View style={styles.typeRow}>
                  {KEY_TYPES.map((k) => (
                    <TouchableOpacity
                      key={k.value}
                      style={[styles.typeBtn, newKeyType === k.value && styles.typeBtnActive]}
                      onPress={() => setNewKeyType(k.value)}
                    >
                      <Text style={[styles.typeText, newKeyType === k.value && styles.typeTextActive]}>
                        {k.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {newKeyType !== 'random' && (
                  <TextInput
                    style={styles.input}
                    placeholder={newKeyType === 'phone' ? '+254712345678' : 'you@example.com'}
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    value={newKeyValue}
                    onChangeText={setNewKeyValue}
                  />
                )}
                <TouchableOpacity style={styles.payBtn} onPress={registerKey}>
                  <Text style={styles.payBtnText}>Register key</Text>
                </TouchableOpacity>
              </View>

              {aliases.map((a) => (
                <View key={a.id} style={styles.card}>
                  <View style={styles.keyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.keyValue}>{a.aliasValue}</Text>
                      <Text style={styles.keyMeta}>
                        {a.aliasType} · receives {a.currency}
                        {a.status !== 'active' ? ' · pending verification' : ''}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeKey(a.id)}>
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                  {a.status === 'pending_verification' && (
                    <View style={styles.lookupRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="6-digit code"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={verifyCodes[a.id] || ''}
                        onChangeText={(v) => setVerifyCodes((m) => ({ ...m, [a.id]: v }))}
                      />
                      <TouchableOpacity style={styles.lookupBtn} onPress={() => verifyKey(a.id)}>
                        <Ionicons name="checkmark" size={18} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text },
  badge: {
    backgroundColor: '#1B9E5A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '600' },
  subtitle: { color: Colors.textMuted, marginTop: 6, marginBottom: 16, fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.text, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: Colors.white },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
    marginBottom: 12,
  },
  lookupRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  lookupBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 12,
  },
  resolvedBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  resolvedName: { fontWeight: '700', color: Colors.text, fontSize: 15 },
  resolvedMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  payBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { fontSize: 13, color: Colors.text },
  typeTextActive: { color: Colors.white, fontWeight: '600' },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  keyValue: { fontWeight: '600', color: Colors.text, fontSize: 14 },
  keyMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});

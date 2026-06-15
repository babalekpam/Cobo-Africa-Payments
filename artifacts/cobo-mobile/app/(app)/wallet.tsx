import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { api, Wallet } from '../../services/api';
import { WalletCard } from '../../components/WalletCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useWallets } from '../../hooks/useWallets';
import { CURRENCIES, Currency, formatBalance } from '../../constants/currencies';

export default function WalletScreen() {
  const { wallets, isLoading, error, fetchWallets } = useWallets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchWallets();
    setIsRefreshing(false);
  }, [fetchWallets]);

  const handleSetDefault = async (walletId: string) => {
    try {
      await api.put(`/api/wallets/${walletId}/default`, {});
      await fetchWallets();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update default wallet');
    }
  };

  const handleAddWallet = async (currency: string) => {
    setIsAdding(true);
    setAddError('');
    try {
      await api.post('/api/wallets', { currency });
      setShowAddWallet(false);
      await fetchWallets();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setIsAdding(false);
    }
  };

  const existingCurrencies = new Set(wallets.map((w) => w.currency));
  const availableCurrencies = CURRENCIES.filter((c) => !existingCurrencies.has(c.code));

  const totalUSD = wallets
    .filter((w) => w.currency === 'USD')
    .reduce((s, w) => s + w.balance, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wallets</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddWallet(true)}
        >
          <Ionicons name="add" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <LoadingSpinner message="Loading wallets..." />
      ) : error ? (
        <View style={styles.errorState}>
          <Ionicons name="wifi-outline" size={40} color={Colors.border} />
          <Text style={styles.errorTitle}>Could not load wallets</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchWallets}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Summary */}
          {wallets.length > 0 && (
            <LinearGradient
              colors={['#C98A1A', '#A67015']}
              style={styles.summaryCard}
            >
              <Text style={styles.summaryLabel}>Total Wallets</Text>
              <Text style={styles.summaryCount}>{wallets.length}</Text>
              <Text style={styles.summaryNote}>
                {totalUSD > 0 ? `USD ${totalUSD.toFixed(2)} in USD wallets` : 'Multi-currency portfolio'}
              </Text>
            </LinearGradient>
          )}

          {wallets.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>No wallets yet</Text>
              <Text style={styles.emptySub}>Add your first wallet to get started</Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setShowAddWallet(true)}
              >
                <LinearGradient
                  colors={['#C98A1A', '#A67015']}
                  style={styles.emptyAddGradient}
                >
                  <Ionicons name="add" size={18} color={Colors.white} />
                  <Text style={styles.emptyAddText}>Add Wallet</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                currency={wallet.currency}
                balance={wallet.balance}
                isDefault={wallet.isDefault}
                onSetDefault={() => handleSetDefault(wallet.id)}
              />
            ))
          )}

          {wallets.length > 0 && (
            <TouchableOpacity
              style={styles.addWalletBtn}
              onPress={() => setShowAddWallet(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addWalletText}>Add New Wallet</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Add Wallet Modal */}
      <Modal visible={showAddWallet} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Wallet</Text>
              <TouchableOpacity onPress={() => { setShowAddWallet(false); setAddError(''); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {addError ? (
              <View style={styles.modalError}>
                <Text style={styles.modalErrorText}>{addError}</Text>
              </View>
            ) : null}

            <Text style={styles.modalSubtitle}>
              Select a currency for your new wallet
            </Text>

            {availableCurrencies.length === 0 ? (
              <View style={styles.allAddedState}>
                <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                <Text style={styles.allAddedText}>You have wallets for all available currencies</Text>
              </View>
            ) : (
              <FlatList
                data={availableCurrencies}
                keyExtractor={(item) => item.code}
                renderItem={({ item }: { item: Currency }) => (
                  <TouchableOpacity
                    style={styles.currencyOption}
                    onPress={() => handleAddWallet(item.code)}
                    disabled={isAdding}
                  >
                    <Text style={styles.currencyFlag}>{item.flag}</Text>
                    <View style={styles.currencyInfo}>
                      <Text style={styles.currencyCode}>{item.code}</Text>
                      <Text style={styles.currencyName}>{item.name}</Text>
                    </View>
                    <Text style={styles.currencySymbol}>{item.symbol}</Text>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                )}
                style={styles.currencyList}
              />
            )}

            {isAdding && <LoadingSpinner message="Creating wallet..." />}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fef9f0',
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  summaryCount: { fontSize: 40, fontWeight: '800', color: Colors.white },
  summaryNote: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.textMuted, marginTop: 6, marginBottom: 24 },
  emptyAddBtn: { borderRadius: 12, overflow: 'hidden' },
  emptyAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyAddText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  addWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    marginTop: 4,
  },
  addWalletText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginTop: 12 },
  errorSub: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalSubtitle: { fontSize: 13, color: Colors.textMuted, paddingHorizontal: 16, paddingTop: 12 },
  modalError: {
    margin: 12,
    padding: 10,
    backgroundColor: Colors.errorLight,
    borderRadius: 8,
  },
  modalErrorText: { fontSize: 13, color: Colors.error },
  currencyList: { marginTop: 8 },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  currencyFlag: { fontSize: 24 },
  currencyInfo: { flex: 1 },
  currencyCode: { fontSize: 14, fontWeight: '600', color: Colors.text },
  currencyName: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  currencySymbol: { fontSize: 13, color: Colors.textMuted, marginRight: 4 },
  allAddedState: { alignItems: 'center', padding: 32 },
  allAddedText: { fontSize: 14, color: Colors.textMuted, marginTop: 12, textAlign: 'center' },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { api, User, Wallet, Transaction } from '../../services/api';
import { authService } from '../../services/auth';
import { TransactionItem } from '../../components/TransactionItem';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatBalance, getCurrencyByCode } from '../../constants/currencies';

interface QuickAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Send', icon: 'paper-plane', route: '/(app)/send', color: Colors.primary },
  { label: 'Receive', icon: 'arrow-down-circle', route: '/(app)/wallet', color: Colors.success },
  { label: 'Exchange', icon: 'swap-horizontal', route: '/(app)/wallet', color: Colors.warning },
  { label: 'Deposit', icon: 'add-circle', route: '/(app)/wallet', color: Colors.sidebar },
];

function SkeletonLine({ width, height = 14 }: { width: number | string; height?: number }) {
  return (
    <View
      style={{
        width: width as number,
        height,
        borderRadius: height / 2,
        backgroundColor: '#e5e7eb',
        marginVertical: 3,
      }}
    />
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');

    try {
      const [userData, walletsData, txData, notifData] = await Promise.allSettled([
        api.get<User>('/api/auth/me'),
        api.get<Wallet[]>('/api/wallets'),
        api.get<Transaction[]>('/api/transactions'),
        api.get<{ count: number }>('/api/notifications'),
      ]);

      if (userData.status === 'fulfilled') setUser(userData.value);
      if (walletsData.status === 'fulfilled') setWallets(walletsData.value);
      if (txData.status === 'fulfilled') setTransactions(txData.value.slice(0, 5));
      if (notifData.status === 'fulfilled') setNotificationCount(notifData.value.count || 0);
    } catch {
      setError('Failed to load dashboard data. Pull to refresh.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingHeader}>
          <SkeletonLine width={160} height={20} />
          <SkeletonLine width={40} height={40} />
        </View>
        <LoadingSpinner message="Loading your dashboard..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>
              {user ? `${user.firstName} ${user.lastName}` : 'Valued Customer'}
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Balance Card */}
        <LinearGradient
          colors={['#0F2B4C', '#1e4a7a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            {defaultWallet
              ? formatBalance(defaultWallet.balance, defaultWallet.currency)
              : 'No wallets yet'}
          </Text>
          {wallets.length > 1 && (
            <Text style={styles.walletCount}>
              {wallets.length} wallets
            </Text>
          )}
          <View style={styles.cardDecoration} />
        </LinearGradient>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* My Wallets Summary */}
        {wallets.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>My Wallets</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/wallet' as any)}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {wallets.slice(0, 4).map((w) => {
                const currencyInfo = getCurrencyByCode(w.currency);
                return (
                  <View key={w.id} style={styles.miniWallet}>
                    <Text style={styles.miniWalletFlag}>{currencyInfo?.flag || '💰'}</Text>
                    <Text style={styles.miniWalletCurrency}>{w.currency}</Text>
                    <Text style={styles.miniWalletBalance}>
                      {formatBalance(w.balance, w.currency)}
                    </Text>
                    {w.isDefault && (
                      <View style={styles.miniDefaultDot} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/transactions' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={Colors.border} />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySubtitle}>
                Your recent transactions will appear here
              </Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  loadingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 20,
  },
  greeting: { fontSize: 13, color: Colors.textMuted },
  userName: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 2 },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
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
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: Colors.sidebar,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  balanceAmount: { fontSize: 32, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },
  walletCount: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  cardDecoration: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    width: '22%',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: { fontSize: 11, fontWeight: '500', color: Colors.text, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  miniWallet: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginRight: 12,
    minWidth: 130,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  miniWalletFlag: { fontSize: 22, marginBottom: 6 },
  miniWalletCurrency: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  miniWalletBalance: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 2 },
  miniDefaultDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.white,
    borderRadius: 16,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
});

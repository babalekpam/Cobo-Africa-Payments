import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { api, Transaction } from '../../services/api';
import { TransactionItem } from '../../components/TransactionItem';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatBalance, getCurrencyByCode } from '../../constants/currencies';

type FilterType = 'all' | 'send' | 'receive' | 'exchange' | 'deposit';
type FilterStatus = 'all' | 'pending' | 'completed' | 'failed' | 'cancelled';

const TYPE_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Sent', value: 'send' },
  { label: 'Received', value: 'receive' },
  { label: 'Exchange', value: 'exchange' },
  { label: 'Deposit', value: 'deposit' },
];

const STATUS_OPTIONS: { label: string; value: FilterStatus }[] = [
  { label: 'All Status', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 20;

  const fetchTransactions = useCallback(async (reset = false) => {
    if (reset) {
      setIsLoading(true);
      setPage(1);
    }
    setError('');

    try {
      const currentPage = reset ? 1 : page;
      const data = await api.get<Transaction[]>(
        `/api/transactions?page=${currentPage}&limit=${PAGE_SIZE}`
      );

      if (reset) {
        setTransactions(data);
      } else {
        setTransactions((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page]);

  useEffect(() => {
    fetchTransactions(true);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTransactions(true);
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoading) return;
    setPage((p) => p + 1);
    fetchTransactions();
  };

  const filtered = transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        tx.description.toLowerCase().includes(q) ||
        (tx.recipient?.toLowerCase().includes(q) ?? false) ||
        (tx.sender?.toLowerCase().includes(q) ?? false) ||
        (tx.reference?.toLowerCase().includes(q) ?? false) ||
        tx.amount.toString().includes(q)
      );
    }
    return true;
  });

  // Group by date
  const grouped: Record<string, Transaction[]> = {};
  filtered.forEach((tx) => {
    const key = new Date(tx.createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  });

  const activeFilters = (typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => alert('CSV export will be emailed to you within 24 hours.')}
        >
          <Ionicons name="download-outline" size={18} color={Colors.primary} />
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions..."
            placeholderTextColor={Colors.textLight}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilters > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilters > 0 ? Colors.white : Colors.primary}
          />
          {activeFilters > 0 && (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{activeFilters}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active filter chips */}
      {activeFilters > 0 && (
        <View style={styles.chipsRow}>
          {typeFilter !== 'all' && (
            <TouchableOpacity
              style={styles.chip}
              onPress={() => setTypeFilter('all')}
            >
              <Text style={styles.chipText}>Type: {typeFilter}</Text>
              <Ionicons name="close" size={12} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {statusFilter !== 'all' && (
            <TouchableOpacity
              style={styles.chip}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={styles.chipText}>Status: {statusFilter}</Text>
              <Ionicons name="close" size={12} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLoading ? (
        <LoadingSpinner message="Loading transactions..." />
      ) : error ? (
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Could not load transactions</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchTransactions(true)}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyTitle}>No transactions found</Text>
          <Text style={styles.emptySub}>
            {search || activeFilters > 0
              ? 'Try adjusting your search or filters'
              : 'Your transactions will appear here'}
          </Text>
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
          onScrollEndDrag={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
            if (isEnd) handleLoadMore();
          }}
        >
          <Text style={styles.resultCount}>
            {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
          </Text>

          {Object.entries(grouped).map(([date, txs]) => (
            <View key={date} style={styles.group}>
              <Text style={styles.groupDate}>{date}</Text>
              {txs.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  onPress={() => setSelectedTx(tx)}
                />
              ))}
            </View>
          ))}

          {hasMore && !isLoading && (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
              <Text style={styles.loadMoreText}>Load more</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter Transactions</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.filterSectionLabel}>Transaction Type</Text>
              <View style={styles.filterOptions}>
                {TYPE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.filterOption, typeFilter === opt.value && styles.filterOptionActive]}
                    onPress={() => setTypeFilter(opt.value)}
                  >
                    <Text style={[styles.filterOptionText, typeFilter === opt.value && styles.filterOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterSectionLabel}>Status</Text>
              <View style={styles.filterOptions}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.filterOption, statusFilter === opt.value && styles.filterOptionActive]}
                    onPress={() => setStatusFilter(opt.value)}
                  >
                    <Text style={[styles.filterOptionText, statusFilter === opt.value && styles.filterOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => { setTypeFilter('all'); setStatusFilter('all'); }}
              >
                <Text style={styles.clearBtnText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal visible={!!selectedTx} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Transaction Details</Text>
              <TouchableOpacity onPress={() => setSelectedTx(null)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView contentContainerStyle={styles.detailContent}>
                <View style={styles.detailAmount}>
                  <Text style={styles.detailAmountText}>
                    {getCurrencyByCode(selectedTx.currency)?.symbol}{' '}
                    {selectedTx.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.detailCurrency}>{selectedTx.currency}</Text>
                </View>

                <StatusBadge status={selectedTx.status} />

                <View style={styles.detailRows}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Type</Text>
                    <Text style={styles.detailVal}>{selectedTx.type}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Description</Text>
                    <Text style={styles.detailVal}>{selectedTx.description}</Text>
                  </View>
                  {selectedTx.recipient && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Recipient</Text>
                      <Text style={styles.detailVal}>{selectedTx.recipient}</Text>
                    </View>
                  )}
                  {selectedTx.sender && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Sender</Text>
                      <Text style={styles.detailVal}>{selectedTx.sender}</Text>
                    </View>
                  )}
                  {selectedTx.fee !== undefined && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Fee</Text>
                      <Text style={styles.detailVal}>{getCurrencyByCode(selectedTx.currency)?.symbol} {selectedTx.fee?.toFixed(2)}</Text>
                    </View>
                  )}
                  {selectedTx.reference && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Reference</Text>
                      <Text style={[styles.detailVal, styles.refText]}>{selectedTx.reference}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Date & Time</Text>
                    <Text style={styles.detailVal}>{formatFullDate(selectedTx.createdAt)}</Text>
                  </View>
                </View>
              </ScrollView>
            )}
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  exportText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.text },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCountText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fef9f0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  resultCount: { fontSize: 12, color: Colors.textMuted, marginBottom: 12, marginTop: 4 },
  group: { marginBottom: 20 },
  groupDate: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginTop: 12 },
  errorSub: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 },
  retryText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  filterModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  filterSectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterOptionText: { fontSize: 13, color: Colors.text },
  filterOptionTextActive: { color: Colors.white, fontWeight: '600' },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  clearBtnText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  applyBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 14, color: Colors.white, fontWeight: '700' },
  detailModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  detailContent: { padding: 20 },
  detailAmount: { alignItems: 'center', marginBottom: 12 },
  detailAmountText: { fontSize: 32, fontWeight: '800', color: Colors.text },
  detailCurrency: { fontSize: 14, color: Colors.textMuted, marginTop: 2 },
  detailRows: { marginTop: 20, backgroundColor: Colors.borderLight, borderRadius: 12, padding: 14, gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailKey: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  detailVal: { fontSize: 13, color: Colors.text, fontWeight: '500', flex: 2, textAlign: 'right' },
  refText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 },
});

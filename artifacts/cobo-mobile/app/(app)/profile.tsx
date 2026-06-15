import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { api, User } from '../../services/api';
import { authService } from '../../services/auth';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface SettingItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress: () => void;
  danger?: boolean;
  chevron?: boolean;
  badge?: string;
}

const KYC_LEVELS = [
  {
    level: 0,
    label: 'Unverified',
    limit: 'No transactions allowed',
    color: Colors.error,
  },
  {
    level: 1,
    label: 'Basic',
    limit: '$5,000/day limit',
    color: Colors.warning,
  },
  {
    level: 2,
    label: 'Verified',
    limit: '$50,000/day limit',
    color: Colors.success,
  },
  {
    level: 3,
    label: 'Advanced',
    limit: '$500,000/day limit',
    color: Colors.primary,
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<User>('/api/auth/me');
      setUser(data);
    } catch (err) {
      // Fall back to cached user
      const cached = await authService.getCachedUser();
      if (cached) {
        setUser(cached);
      } else {
        setError('Could not load profile');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await authService.logout();
    router.replace('/(auth)/login');
  };

  const kycLevel = KYC_LEVELS.find((k) => k.level === (user?.kycLevel || 0)) || KYC_LEVELS[0];
  const kycProgress = user ? (user.kycLevel / 3) * 100 : 0;

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : '?';

  const settingsGroups: { title: string; items: SettingItem[] }[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'edit-profile',
          label: 'Edit Profile',
          subtitle: 'Name, email, phone',
          icon: 'person-outline',
          onPress: () => Alert.alert('Edit Profile', 'Feature coming soon.'),
          chevron: true,
        },
        {
          id: 'kyc',
          label: 'KYC Verification',
          subtitle: kycLevel.label,
          icon: 'shield-checkmark-outline',
          iconColor: kycLevel.color,
          onPress: () => Alert.alert('KYC Verification', 'Complete your identity verification to increase limits.'),
          chevron: true,
          badge: kycLevel.label,
        },
        {
          id: 'notifications',
          label: 'Notifications',
          subtitle: 'Manage alerts & push notifications',
          icon: 'notifications-outline',
          onPress: () => Alert.alert('Notifications', 'Notification settings coming soon.'),
          chevron: true,
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          id: '2fa',
          label: 'Security & 2FA',
          subtitle: 'Password, two-factor authentication',
          icon: 'lock-closed-outline',
          onPress: () => Alert.alert('Security', '2FA setup coming soon.'),
          chevron: true,
        },
        {
          id: 'devices',
          label: 'Active Devices',
          subtitle: 'Manage trusted devices',
          icon: 'phone-portrait-outline',
          onPress: () => Alert.alert('Devices', 'Device management coming soon.'),
          chevron: true,
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          id: 'language',
          label: 'Language',
          subtitle: 'English (US)',
          icon: 'language-outline',
          onPress: () => Alert.alert('Language', 'Language selection coming soon.'),
          chevron: true,
        },
        {
          id: 'help',
          label: 'Help & Support',
          subtitle: 'FAQ, contact us',
          icon: 'help-circle-outline',
          onPress: () => Alert.alert('Support', 'Contact support@coboafrica.com'),
          chevron: true,
        },
        {
          id: 'about',
          label: 'About COBO Africa',
          subtitle: 'Version 1.0.0',
          icon: 'information-circle-outline',
          onPress: () => Alert.alert('About', 'COBO Africa v1.0.0\nAfrica\'s Payment Platform'),
          chevron: true,
        },
      ],
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner fullScreen message="Loading profile..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={['#C98A1A', '#A67015']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>

          <Text style={styles.userName}>
            {user ? `${user.firstName} ${user.lastName}` : 'User'}
          </Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          {user?.businessName && (
            <Text style={styles.businessName}>{user.businessName}</Text>
          )}

          {/* KYC Badge */}
          <View style={[styles.kycBadge, { backgroundColor: `${kycLevel.color}18`, borderColor: kycLevel.color }]}>
            <Ionicons name="shield-checkmark" size={12} color={kycLevel.color} />
            <Text style={[styles.kycBadgeText, { color: kycLevel.color }]}>
              Level {user?.kycLevel || 0} — {kycLevel.label}
            </Text>
          </View>
        </View>

        {/* KYC Progress */}
        <View style={styles.kycCard}>
          <View style={styles.kycCardHeader}>
            <Text style={styles.kycCardTitle}>Verification Level</Text>
            <Text style={styles.kycCardLimit}>{kycLevel.limit}</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${kycProgress}%`, backgroundColor: kycLevel.color },
              ]}
            />
          </View>
          <View style={styles.kycLevelDots}>
            {KYC_LEVELS.map((lvl) => (
              <View key={lvl.level} style={styles.kycLevelDot}>
                <View
                  style={[
                    styles.dot,
                    (user?.kycLevel || 0) >= lvl.level
                      ? { backgroundColor: lvl.color }
                      : { backgroundColor: Colors.border },
                  ]}
                />
                <Text style={styles.dotLabel}>L{lvl.level}</Text>
              </View>
            ))}
          </View>
          {(user?.kycLevel || 0) < 3 && (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => Alert.alert('Upgrade', 'KYC upgrade process will start here.')}
            >
              <Text style={styles.upgradeBtnText}>Upgrade to Level {(user?.kycLevel || 0) + 1}</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Settings Groups */}
        {settingsGroups.map((group) => (
          <View key={group.title} style={styles.settingGroup}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.groupCard}>
              {group.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingItem,
                    idx < group.items.length - 1 && styles.settingItemBorder,
                    item.danger && styles.settingItemDanger,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.settingIcon, { backgroundColor: `${item.iconColor || Colors.primary}15` }]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={item.iconColor || Colors.primary}
                    />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingLabel, item.danger && styles.dangerText]}>
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                  {item.badge && (
                    <View style={[styles.badge, { backgroundColor: `${kycLevel.color}18` }]}>
                      <Text style={[styles.badgeText, { color: kycLevel.color }]}>{item.badge}</Text>
                    </View>
                  )}
                  {item.chevron && (
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setShowLogoutConfirm(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>COBO Africa v1.0.0</Text>
      </ScrollView>

      {/* Logout Confirmation */}
      <Modal visible={showLogoutConfirm} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="log-out-outline" size={28} color={Colors.error} />
            </View>
            <Text style={styles.confirmTitle}>Log Out?</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to log out of your COBO Africa account?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmLogoutBtn} onPress={handleLogout}>
                <Text style={styles.confirmLogoutText}>Log Out</Text>
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
  scrollContent: { paddingBottom: 40 },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: Colors.white },
  userName: { fontSize: 20, fontWeight: '700', color: Colors.text },
  userEmail: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  businessName: { fontSize: 12, color: Colors.primary, marginTop: 4, fontWeight: '500' },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  kycBadgeText: { fontSize: 12, fontWeight: '600' },
  kycCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  kycCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kycCardTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  kycCardLimit: { fontSize: 12, color: Colors.textMuted },
  progressBar: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  kycLevelDots: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  kycLevelDot: { alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLabel: { fontSize: 10, color: Colors.textMuted },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 4,
  },
  upgradeBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  settingGroup: { marginHorizontal: 20, marginBottom: 20 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  groupCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  settingItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  settingItemDanger: {},
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '500', color: Colors.text },
  settingSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  dangerText: { color: Colors.error },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginRight: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.errorLight,
    backgroundColor: Colors.errorLight,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.error },
  versionText: { textAlign: 'center', fontSize: 11, color: Colors.textLight, marginTop: 20 },
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
    maxWidth: 340,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  confirmMessage: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  confirmLogoutBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  confirmLogoutText: { fontSize: 14, color: Colors.white, fontWeight: '700' },
});

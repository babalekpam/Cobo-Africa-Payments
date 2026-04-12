import { Layout } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { useUpdateUser, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Bell, Globe, Key, Save, CheckCircle, AlertCircle, Database, Server, MapPin, Cpu } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHealthCheck } from "@workspace/api-client-react";

const NOTIF_STORAGE_KEY = "cobo_notification_prefs";

function getNotifPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveNotifPrefs(prefs: Record<string, boolean>) {
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(prefs));
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateUser();
  const { data: health } = useHealthCheck();

  const [profileName, setProfileName] = useState("");
  const [profileCountry, setProfileCountry] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(getNotifPrefs);
  const [notifSaved, setNotifSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name ?? "");
      setProfileCountry(user.country ?? "");
      setProfilePhone(user.phone ?? "");
    }
  }, [user]);

  const handleSaveProfile = () => {
    if (!user) return;
    setProfileError(null);
    updateMutation.mutate(
      { id: user.id, data: { name: profileName, country: profileCountry, phone: profilePhone } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 3000);
        },
        onError: () => {
          setProfileError("Failed to save profile. Please try again.");
        },
      }
    );
  };

  const handleChangePassword = () => {
    setPasswordError(null);
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!user) return;
    updateMutation.mutate(
      { id: user.id, data: { password: newPassword } },
      {
        onSuccess: () => {
          setPasswordSaved(true);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setTimeout(() => setPasswordSaved(false), 3000);
        },
        onError: () => {
          setPasswordError("Failed to change password.");
        },
      }
    );
  };

  const toggleNotif = (key: string) => {
    const updated = { ...notifPrefs, [key]: !(notifPrefs[key] ?? true) };
    setNotifPrefs(updated);
    saveNotifPrefs(updated);
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2000);
  };

  const notifications = [
    { key: "transaction_alerts", title: "Transaction Alerts", desc: "Get notified for every new transaction" },
    { key: "failed_payments", title: "Failed Payment Alerts", desc: "Alert when payments fail" },
    { key: "merchant_updates", title: "Merchant Updates", desc: "Merchant status changes" },
    { key: "weekly_reports", title: "Weekly Reports", desc: "Weekly payment summaries" },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="text-settings-title">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and platform settings</p>
        </div>

        {/* Profile */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          </div>
          {profileError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{profileError}</p>
            </div>
          )}
          {profileSaved && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-primary">Profile updated successfully!</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Name</Label>
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="bg-input border-border" data-testid="input-profile-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Email</Label>
              <Input value={user?.email ?? ""} type="email" className="bg-input border-border" data-testid="input-profile-email" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Role</Label>
              <Input value={user?.role ?? ""} className="bg-input border-border capitalize" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Country</Label>
              <Input value={profileCountry} onChange={(e) => setProfileCountry(e.target.value)} className="bg-input border-border" data-testid="input-profile-country" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-muted-foreground text-xs">Phone</Label>
              <Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+254..." className="bg-input border-border" data-testid="input-profile-phone" />
            </div>
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={updateMutation.isPending} data-testid="button-save-profile">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {updateMutation.isPending ? "Saving..." : profileSaved ? "Saved!" : "Save Profile"}
          </Button>
        </div>

        {/* Security */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Security</h2>
          </div>
          {passwordError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{passwordError}</p>
            </div>
          )}
          {passwordSaved && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-primary">Password changed successfully!</p>
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Current Password</Label>
              <Input type="password" placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-input border-border" data-testid="input-current-password" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">New Password</Label>
              <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-input border-border" data-testid="input-new-password" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Confirm Password</Label>
              <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-input border-border" data-testid="input-confirm-password" />
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleChangePassword} disabled={updateMutation.isPending} data-testid="button-change-password">
            {updateMutation.isPending ? "Changing..." : passwordSaved ? "Changed!" : "Change Password"}
          </Button>
        </div>

        {/* Notifications */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-chart-3" />
              <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            </div>
            {notifSaved && <span className="text-xs text-primary">Preferences saved</span>}
          </div>
          {notifications.map(({ key, title, desc }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs[key] ?? true}
                  onChange={() => toggleNotif(key)}
                  className="sr-only peer"
                  data-testid={`toggle-${key}`}
                />
                <div className="w-9 h-5 bg-muted rounded-full peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>

        {/* Platform */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-chart-2" />
            <h2 className="text-sm font-semibold text-foreground">Platform</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { icon: Cpu, label: "Version", value: "1.0.0" },
              { icon: Server, label: "Environment", value: health ? "Online" : "Checking..." },
              { icon: MapPin, label: "Region", value: "Africa" },
              { icon: Database, label: "DB Status", value: health?.status === "healthy" ? "Connected" : "Checking..." },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-2.5 px-3 border border-border rounded-lg">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium text-foreground text-sm">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

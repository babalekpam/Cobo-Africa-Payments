import { Layout } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Bell, Globe, Key, Save } from "lucide-react";
import { useState } from "react";

export default function Settings() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Name</Label>
              <Input defaultValue={user?.name ?? ""} className="bg-input border-border" data-testid="input-profile-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Email</Label>
              <Input defaultValue={user?.email ?? ""} type="email" className="bg-input border-border" data-testid="input-profile-email" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Role</Label>
              <Input defaultValue={user?.role ?? ""} className="bg-input border-border capitalize" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Country</Label>
              <Input defaultValue={user?.country ?? ""} className="bg-input border-border" />
            </div>
          </div>
          <Button size="sm" onClick={handleSave} data-testid="button-save-profile">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saved ? "Saved!" : "Save Profile"}
          </Button>
        </div>

        {/* Security */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Security</h2>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Current Password</Label>
              <Input type="password" placeholder="••••••••" className="bg-input border-border" data-testid="input-current-password" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">New Password</Label>
              <Input type="password" placeholder="••••••••" className="bg-input border-border" data-testid="input-new-password" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Confirm Password</Label>
              <Input type="password" placeholder="••••••••" className="bg-input border-border" data-testid="input-confirm-password" />
            </div>
          </div>
          <Button variant="secondary" size="sm" data-testid="button-change-password">Change Password</Button>
        </div>

        {/* Notifications */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-chart-3" />
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
          </div>
          {[
            ["Transaction Alerts", "Get notified for every new transaction"],
            ["Failed Payment Alerts", "Alert when payments fail"],
            ["Merchant Updates", "Merchant status changes"],
            ["Weekly Reports", "Weekly payment summaries"],
          ].map(([title, desc]) => (
            <div key={title} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
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
              ["Version", "1.0.0"],
              ["Environment", "Production"],
              ["Region", "Africa"],
              ["DB Status", "Connected"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

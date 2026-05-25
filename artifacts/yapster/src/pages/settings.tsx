import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useGetMe, useGetSettings, useUpdateSettings, useUpdateProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, LogOut, Moon, Sun, Bell, Eye, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [, setLocation] = useLocation();
  const setToken = useAuthStore((s) => s.setToken);
  const { toast } = useToast();
  
  const { data: me } = useGetMe();
  const { data: settings } = useGetSettings();
  const updateSettingsMutation = useUpdateSettings();
  const updateProfileMutation = useUpdateProfile();
  
  const [displayName, setDisplayName] = useState(me?.displayName || "");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setDisplayName(me?.displayName || "");
  }, [me]);

  useEffect(() => {
    const isDarkCurrent = document.documentElement.classList.contains("dark");
    setIsDark(isDarkCurrent);
  }, []);

  const handleLogout = () => {
    setToken(null);
    setLocation("/login");
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ data: { displayName } }, {
      onSuccess: () => {
        toast({ title: "Profile updated" });
      }
    });
  };

  const toggleDark = (checked: boolean) => {
    setIsDark(checked);
    if (checked) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background md:bg-muted/30 flex flex-col md:py-8">
      <div className="w-full max-w-2xl mx-auto bg-card min-h-screen md:min-h-0 md:rounded-2xl md:border shadow-sm flex flex-col">
        <div className="h-14 border-b flex items-center px-4 gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="-ml-2" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Settings</h1>
        </div>
        
        <div className="p-4 md:p-6 flex-1 space-y-8 overflow-y-auto">
          {/* Profile Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <UserCircle className="h-4 w-4" /> Account
            </h2>
            <div className="bg-muted/30 border rounded-xl p-4 space-y-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <div className="flex gap-2">
                  <Input 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                  />
                  <Button 
                    variant="secondary" 
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending || displayName === me?.displayName}
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={me?.username || ""} disabled />
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <Eye className="h-4 w-4" /> Preferences
            </h2>
            <div className="bg-muted/30 border rounded-xl divide-y">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isDark ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <div className="font-medium">Dark Mode</div>
                    <div className="text-xs text-muted-foreground">Toggle app appearance</div>
                  </div>
                </div>
                <Switch checked={isDark} onCheckedChange={toggleDark} />
              </div>
              
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Push Notifications</div>
                    <div className="text-xs text-muted-foreground">Receive message alerts</div>
                  </div>
                </div>
                <Switch 
                  checked={settings?.pushNotifications ?? true} 
                  onCheckedChange={(v) => updateSettingsMutation.mutate({ data: { pushNotifications: v } })}
                />
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-4">
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

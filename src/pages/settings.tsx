import React, { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { Monitor, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

export function SecurityTab() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords don't match", {
        description: "Your new password and confirmation must match.",
      });
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error("Password too short", {
        description: "New password must be at least 6 characters long.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8081/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user?.email,
          old_password: formData.currentPassword,
          new_password: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update password");
      }

      toast.success("Password updated successfully");
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error("Error updating password", {
        description: error.message || "Please check your current password and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current password</Label>
              <Input
                id="current-pw"
                name="currentPassword"
                type="password"
                placeholder="••••••••"
                value={formData.currentPassword}
                onChange={handleChange}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input
                  id="new-pw"
                  name="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirm password</Label>
                <Input
                  id="confirm-pw"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" type="submit" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
          <CardDescription>Manage your active sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Current session</p>
                <p className="text-xs text-muted-foreground">Chrome · Linux · Active now</p>
              </div>
            </div>
            <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">MacBook Pro</p>
                <p className="text-xs text-muted-foreground">Safari · Last active 2d ago</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive">Revoke</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="h-4 w-4" />
            Danger zone
          </CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
            </div>
            <Button variant="destructive" size="sm">
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main page component expected by App.tsx
export function SettingsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
      </div>
      <SecurityTab />
    </div>
  );
}
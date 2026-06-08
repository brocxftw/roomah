"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

import {
  SettingsPageContent,
  type CommissionTargetValues,
  type DashboardTargets,
  type NotificationPreferences,
  type PasswordValues,
  type ProfileValues,
  type SecurityValues,
  type SettingsUser,
} from "./settings-page-content";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function announceSettingsUpdate(user: SettingsUser) {
  window.dispatchEvent(
    new CustomEvent("roomah:user-settings-updated", {
      detail: user,
    })
  );
}

export default function ProfilePage() {
  const { getToken, supabase } = useAuth();
  const [user, setUser] = useState<SettingsUser | null>(null);
  const [targets, setTargets] = useState<DashboardTargets | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    const token = await getToken();
    const [me, dashboard] = await Promise.all([
      apiFetch<SettingsUser>("/users/me", token),
      apiFetch<DashboardTargets>("/dashboard?date_range=month", token),
    ]);
    setUser(me);
    setTargets(dashboard);
    setError(null);
    announceSettingsUpdate(me);
    return me;
  }

  useEffect(() => {
    void loadProfile().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  async function patchCurrentUser(body: Record<string, unknown>) {
    const token = await getToken();
    await apiFetch<SettingsUser>("/users/me", token, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await loadProfile();
  }

  async function saveProfile(values: ProfileValues) {
    await patchCurrentUser(values);
  }

  async function saveCommissionTarget(values: CommissionTargetValues) {
    await patchCurrentUser(values);
  }

  async function saveNotifications(values: NotificationPreferences) {
    await patchCurrentUser({ notification_preferences: values });
  }

  async function saveSecurity(values: SecurityValues) {
    await patchCurrentUser(values);
  }

  async function saveTeamTarget(amount: number) {
    const token = await getToken();
    await apiFetch("/manager/team-target", token, {
      method: "PATCH",
      body: JSON.stringify({ monthly_target_amount: amount }),
    });
    await loadProfile();
  }

  async function uploadAvatar(file: File) {
    if (!AVATAR_MIME_TYPES.has(file.type)) {
      throw new Error("Upload a JPG, PNG, or WebP profile picture.");
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new Error("Profile picture must be 5MB or smaller.");
    }

    const token = await getToken();
    const { storage_path, token: uploadToken, public_url } = await apiFetch<{
      storage_path: string;
      token: string;
      public_url: string;
    }>("/users/me/avatar/upload-url", token, {
      method: "POST",
      body: JSON.stringify({ content_type: file.type }),
    });

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .uploadToSignedUrl(storage_path, uploadToken, file, {
        contentType: file.type,
      });
    if (uploadError) {
      throw uploadError;
    }

    await patchCurrentUser({ avatar_url: public_url });
  }

  async function removeAvatar() {
    await patchCurrentUser({ avatar_url: null });
  }

  async function changePassword(values: PasswordValues) {
    if (!user?.email) {
      throw new Error("Unable to verify the current account email.");
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: values.currentPassword,
    });
    if (signInError) {
      throw signInError;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: values.newPassword,
    });
    if (updateError) {
      throw updateError;
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!user || !targets) {
    return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  }

  return (
    <SettingsPageContent
      user={user}
      targets={targets}
      appVersion={APP_VERSION}
      onSaveProfile={saveProfile}
      onSaveCommissionTarget={saveCommissionTarget}
      onSaveNotifications={saveNotifications}
      onSaveSecurity={saveSecurity}
      onChangePassword={changePassword}
      onSaveTeamTarget={saveTeamTarget}
      onUploadAvatar={uploadAvatar}
      onRemoveAvatar={removeAvatar}
    />
  );
}


"use client";

import {
  getActiveAppUser,
  getScopedLocalStoreKey,
  isAccountAuthUser,
  isGuestAppUser
} from "@/lib/app-users";
import { appLocalStorageKeys, localStoreKeys } from "@/lib/local-store-keys";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

type SnapshotValue = string | null;

export interface CloudSyncMetadata {
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
  userId: string | null;
  profileId: string | null;
  profileName: string | null;
}

export interface CloudSyncStatus extends CloudSyncMetadata {
  configured: boolean;
}

interface AppStateSnapshot {
  version: 2 | 3;
  createdAt: string;
  profileId: string;
  profileName: string;
  values: Record<string, SnapshotValue>;
}

const emptyMetadata: CloudSyncMetadata = {
  lastPushAt: null,
  lastPullAt: null,
  lastError: null,
  userId: null,
  profileId: null,
  profileName: null
};

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let suppressAutoSync = false;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function loadMetadata(): CloudSyncMetadata {
  if (!canUseStorage()) return emptyMetadata;

  try {
    const raw = window.localStorage.getItem(getScopedLocalStoreKey(localStoreKeys.cloudSyncMeta));
    return raw ? { ...emptyMetadata, ...(JSON.parse(raw) as Partial<CloudSyncMetadata>) } : emptyMetadata;
  } catch {
    return emptyMetadata;
  }
}

function saveMetadata(metadata: CloudSyncMetadata) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    getScopedLocalStoreKey(localStoreKeys.cloudSyncMeta),
    JSON.stringify(metadata)
  );
}

function setSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown cloud sync error";
  saveMetadata({ ...loadMetadata(), lastError: message });
  return message;
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return {
    configured: isSupabaseConfigured(),
    ...loadMetadata()
  };
}

export function exportLocalAppSnapshot(): AppStateSnapshot {
  const profile = getActiveAppUser();
  if (!profile) {
    throw new Error("먼저 로그인하세요.");
  }

  const values = appLocalStorageKeys.reduce<Record<string, SnapshotValue>>((snapshot, key) => {
    snapshot[key] = canUseStorage()
      ? window.localStorage.getItem(getScopedLocalStoreKey(key, profile.id))
      : null;
    return snapshot;
  }, {});

  return {
    version: 3,
    createdAt: new Date().toISOString(),
    profileId: profile.id,
    profileName: profile.name,
    values
  };
}

export function restoreLocalAppSnapshot(snapshot: AppStateSnapshot) {
  if (!canUseStorage()) return;
  const profile = getActiveAppUser();
  if (!profile) {
    throw new Error("먼저 로그인하세요.");
  }

  suppressAutoSync = true;
  try {
    appLocalStorageKeys.forEach((key) => {
      const value = snapshot.values[key] ?? null;
      const scopedKey = getScopedLocalStoreKey(key, profile.id);
      if (value === null) {
        window.localStorage.removeItem(scopedKey);
      } else {
        window.localStorage.setItem(scopedKey, value);
      }
    });
  } finally {
    suppressAutoSync = false;
  }
}

export async function ensureCloudSession() {
  const profile = getActiveAppUser();
  if (!profile) {
    throw new Error("먼저 로그인하세요.");
  }

  if (isGuestAppUser(profile)) {
    throw new Error("게스트 모드는 클라우드 동기화를 사용하지 않습니다.");
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 없습니다.");
  }

  const existing = await supabase.auth.getSession();
  const authUser = existing.data.session?.user ?? null;
  if (isAccountAuthUser(authUser)) {
    const userId = authUser.id;
    saveMetadata({
      ...loadMetadata(),
      userId,
      profileId: profile.id,
      profileName: profile.name,
      lastError: null
    });
    return { supabase, userId };
  }

  throw new Error("로그인된 Supabase 계정이 없습니다. 먼저 로그인하세요.");
}

export async function pushLocalSnapshotToCloud() {
  const profile = getActiveAppUser();
  if (!profile) {
    throw new Error("먼저 로그인하세요.");
  }

  const { supabase, userId } = await ensureCloudSession();
  const snapshot = exportLocalAppSnapshot();
  const updatedAt = new Date().toISOString();

  const result = await supabase.from("app_state_snapshots").upsert({
    user_id: userId,
    profile_id: profile.id,
    profile_name: profile.name,
    snapshot,
    updated_at: updatedAt
  });

  if (result.error) throw new Error(result.error.message);

  saveMetadata({
    ...loadMetadata(),
    lastPushAt: updatedAt,
    lastError: null,
    userId,
    profileId: profile.id,
    profileName: profile.name
  });

  return { userId, updatedAt };
}

export async function pullCloudSnapshotToLocal() {
  const profile = getActiveAppUser();
  if (!profile) {
    throw new Error("먼저 로그인하세요.");
  }

  const { supabase, userId } = await ensureCloudSession();
  const result = await supabase
    .from("app_state_snapshots")
    .select("snapshot, updated_at")
    .eq("user_id", userId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  if (!result.data?.snapshot) {
    throw new Error("클라우드에 저장된 앱 상태가 아직 없습니다.");
  }

  restoreLocalAppSnapshot(result.data.snapshot as AppStateSnapshot);
  const pulledAt = new Date().toISOString();
  saveMetadata({
    ...loadMetadata(),
    lastPullAt: pulledAt,
    lastError: null,
    userId,
    profileId: profile.id,
    profileName: profile.name
  });

  return { userId, pulledAt, cloudUpdatedAt: result.data.updated_at as string | null };
}

export function queueCloudSync() {
  if (suppressAutoSync || !canUseStorage() || !isSupabaseConfigured()) return;
  const profile = getActiveAppUser();
  if (!profile || isGuestAppUser(profile)) return;
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    void pushLocalSnapshotToCloud().catch((error) => {
      setSyncError(error);
    });
  }, 1500);
}

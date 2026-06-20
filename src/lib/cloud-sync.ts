"use client";

import { appLocalStorageKeys, localStoreKeys } from "@/lib/local-store-keys";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

type SnapshotValue = string | null;

export interface CloudSyncMetadata {
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
  userId: string | null;
}

export interface CloudSyncStatus extends CloudSyncMetadata {
  configured: boolean;
}

interface AppStateSnapshot {
  version: 1;
  createdAt: string;
  values: Record<string, SnapshotValue>;
}

const emptyMetadata: CloudSyncMetadata = {
  lastPushAt: null,
  lastPullAt: null,
  lastError: null,
  userId: null
};

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let suppressAutoSync = false;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function loadMetadata(): CloudSyncMetadata {
  if (!canUseStorage()) return emptyMetadata;

  try {
    const raw = window.localStorage.getItem(localStoreKeys.cloudSyncMeta);
    return raw ? { ...emptyMetadata, ...(JSON.parse(raw) as Partial<CloudSyncMetadata>) } : emptyMetadata;
  } catch {
    return emptyMetadata;
  }
}

function saveMetadata(metadata: CloudSyncMetadata) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(localStoreKeys.cloudSyncMeta, JSON.stringify(metadata));
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
  const values = appLocalStorageKeys.reduce<Record<string, SnapshotValue>>((snapshot, key) => {
    snapshot[key] = canUseStorage() ? window.localStorage.getItem(key) : null;
    return snapshot;
  }, {});

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    values
  };
}

export function restoreLocalAppSnapshot(snapshot: AppStateSnapshot) {
  if (!canUseStorage()) return;

  suppressAutoSync = true;
  try {
    appLocalStorageKeys.forEach((key) => {
      const value = snapshot.values[key] ?? null;
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    });
  } finally {
    suppressAutoSync = false;
  }
}

export async function ensureCloudSession() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 없습니다.");
  }

  const existing = await supabase.auth.getSession();
  if (existing.data.session?.user) {
    const userId = existing.data.session.user.id;
    saveMetadata({ ...loadMetadata(), userId, lastError: null });
    return { supabase, userId };
  }

  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error || !signedIn.data.user) {
    throw new Error(
      signedIn.error?.message
        ?? "익명 Supabase 세션을 만들지 못했습니다. Supabase Auth anonymous provider를 확인하세요."
    );
  }

  const userId = signedIn.data.user.id;
  saveMetadata({ ...loadMetadata(), userId, lastError: null });
  return { supabase, userId };
}

export async function pushLocalSnapshotToCloud() {
  const { supabase, userId } = await ensureCloudSession();
  const snapshot = exportLocalAppSnapshot();
  const updatedAt = new Date().toISOString();

  const result = await supabase.from("app_state_snapshots").upsert({
    user_id: userId,
    snapshot,
    updated_at: updatedAt
  });

  if (result.error) throw new Error(result.error.message);

  saveMetadata({
    ...loadMetadata(),
    lastPushAt: updatedAt,
    lastError: null,
    userId
  });

  return { userId, updatedAt };
}

export async function pullCloudSnapshotToLocal() {
  const { supabase, userId } = await ensureCloudSession();
  const result = await supabase
    .from("app_state_snapshots")
    .select("snapshot, updated_at")
    .eq("user_id", userId)
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
    userId
  });

  return { userId, pulledAt, cloudUpdatedAt: result.data.updated_at as string | null };
}

export function queueCloudSync() {
  if (suppressAutoSync || !canUseStorage() || !isSupabaseConfigured()) return;
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    void pushLocalSnapshotToCloud().catch((error) => {
      setSyncError(error);
    });
  }, 1500);
}

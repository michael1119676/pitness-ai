"use client";

import { appLocalStorageKeys } from "@/lib/local-store-keys";

export interface AppUser {
  id: string;
  name: string;
  accent: string;
  createdAt: string;
}

export const maxAppUsers = 3;

const appUserKeys = {
  users: "adfc_app_users_v1",
  activeUser: "adfc_active_app_user_v1",
  legacyMigration: "adfc_legacy_data_migrated_v1"
} as const;

const accentPool = ["mint", "sky", "coral"] as const;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function makeUserId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `user-${crypto.randomUUID()}`;
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 24) : "사용자";
}

function emitUserChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("adfc-active-user-changed"));
}

function saveAppUsers(users: AppUser[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(appUserKeys.users, JSON.stringify(users));
}

export function loadAppUsers(): AppUser[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(appUserKeys.users);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppUser[];
    return parsed.filter((user) => user.id && user.name).slice(0, maxAppUsers);
  } catch {
    return [];
  }
}

export function getActiveAppUserId() {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(appUserKeys.activeUser);
}

export function getActiveAppUser() {
  const activeId = getActiveAppUserId();
  if (!activeId) return null;
  return loadAppUsers().find((user) => user.id === activeId) ?? null;
}

export function getScopedLocalStoreKey(baseKey: string, userId = getActiveAppUserId()) {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

function migrateLegacyDataToUser(userId: string) {
  if (!canUseStorage()) return;
  if (window.localStorage.getItem(appUserKeys.legacyMigration)) return;

  let copied = 0;
  appLocalStorageKeys.forEach((baseKey) => {
    const legacyValue = window.localStorage.getItem(baseKey);
    const scopedKey = getScopedLocalStoreKey(baseKey, userId);
    if (legacyValue !== null && window.localStorage.getItem(scopedKey) === null) {
      window.localStorage.setItem(scopedKey, legacyValue);
      copied += 1;
    }
  });

  window.localStorage.setItem(
    appUserKeys.legacyMigration,
    JSON.stringify({ userId, copied, migratedAt: new Date().toISOString() })
  );
}

export function setActiveAppUser(userId: string) {
  if (!canUseStorage()) return null;
  const user = loadAppUsers().find((item) => item.id === userId) ?? null;
  if (!user) return null;

  window.localStorage.setItem(appUserKeys.activeUser, user.id);
  migrateLegacyDataToUser(user.id);
  emitUserChange();
  return user;
}

export function clearActiveAppUser() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(appUserKeys.activeUser);
  emitUserChange();
}

export function createAppUser(name: string) {
  if (!canUseStorage()) return null;
  const users = loadAppUsers();
  if (users.length >= maxAppUsers) {
    throw new Error(`사용자는 최대 ${maxAppUsers}명까지 만들 수 있습니다.`);
  }

  const user: AppUser = {
    id: makeUserId(),
    name: normalizeName(name),
    accent: accentPool[users.length % accentPool.length],
    createdAt: new Date().toISOString()
  };

  saveAppUsers([...users, user]);
  setActiveAppUser(user.id);
  return user;
}

export function updateAppUserName(userId: string, name: string) {
  const users = loadAppUsers();
  const nextUsers = users.map((user) =>
    user.id === userId ? { ...user, name: normalizeName(name) } : user
  );
  saveAppUsers(nextUsers);
  emitUserChange();
  return nextUsers.find((user) => user.id === userId) ?? null;
}

export function getUserInitial(name: string) {
  return normalizeName(name).slice(0, 1).toUpperCase();
}

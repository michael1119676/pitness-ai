"use client";

import { equipmentCatalog } from "@/lib/equipment-data";
import type {
  BodyComposition,
  BodyGoalProfile,
  DailyCheckIn,
  DailyPlanRevision,
  MealLog,
  NutritionProfile,
  UserSupplementProfile,
  WorkoutSetLog
} from "@/lib/daily-types";
import {
  emptyWorkoutInput,
  type Equipment,
  type Muscle,
  type UserSettings
} from "@/lib/types";
import { getScopedLocalStoreKey } from "@/lib/app-users";
import { queueCloudSync } from "@/lib/cloud-sync";
import { localStoreKeys } from "@/lib/local-store-keys";

export const defaultSettings: UserSettings = {
  defaultAvailableMinutes: emptyWorkoutInput.availableMinutes,
  defaultIntensity: emptyWorkoutInput.intensity,
  defaultEquipmentPreference: emptyWorkoutInput.equipmentPreference,
  soreMuscles: []
};

export const defaultBodyGoalProfile: BodyGoalProfile = {
  mainBodyGoal: "aesthetic_v_taper",
  priorityMuscles: ["side_delt", "rear_delt", "lats", "upper_back", "upper_chest"],
  avoidOverdevelopmentMuscles: [],
  targetBodyWeightKg: null,
  targetBodyFatPercentage: null,
  targetSkeletalMuscleMassKg: null,
  preferredTrainingStyle: "machine_cable",
  dietAggressiveness: "moderate",
  cardioPreference: "minimal",
  weeklyWeightChangeTargetKg: 0,
  notes: ""
};

export const defaultNutritionProfile: NutritionProfile = {
  startingTargetCalories: 2400,
  targetProteinG: 160,
  targetCarbsG: 280,
  targetFatG: 65,
  mealCount: 4,
  breakfastEnabled: true,
  lunchEnabled: true,
  dinnerEnabled: true,
  snackEnabled: true,
  preferredMealTimes: {
    breakfast: "08:00",
    lunch: "12:30",
    dinner: "19:00",
    snack: "16:00"
  },
  foodPreferences: [],
  dislikedFoods: [],
  allergies: [],
  dietaryRestrictions: [],
  workoutMealTimingPreference: "pre_workout_carbs"
};

export const defaultSupplements: UserSupplementProfile[] = [
  {
    id: "supp-creatine",
    supplementName: "creatine",
    enabled: false,
    userConfiguredDose: "",
    preferredTiming: "아무 때나",
    frequency: "매일",
    notes: ""
  },
  {
    id: "supp-protein",
    supplementName: "protein powder",
    enabled: false,
    userConfiguredDose: "",
    preferredTiming: "단백질 부족 시",
    frequency: "필요 시",
    notes: ""
  },
  {
    id: "supp-caffeine",
    supplementName: "caffeine",
    enabled: false,
    userConfiguredDose: "",
    preferredTiming: "운동 전",
    frequency: "필요 시",
    notes: ""
  }
];

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function makeDefaultCheckIn(date = todayKey()): DailyCheckIn {
  return {
    date,
    trainingIntent: "train",
    bedTime: "23:30",
    wakeTime: "07:30",
    sleepQuality: 3,
    conditionScore: 7,
    sorenessMuscles: [],
    sorenessLevel: {},
    painMuscles: [],
    painLevel: {},
    avoidMusclesToday: [],
    scheduleConstraints: [],
    availableTimeMinutes: 60,
    preferredWorkoutStartTime: "18:30",
    memo: ""
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function mergeWithSeed(stored: Equipment[]) {
  const storedById = new Map(stored.map((item) => [item.id, item]));
  const merged = equipmentCatalog.map((seed) => storedById.get(seed.id) ?? seed);
  const custom = stored.filter((item) => !equipmentCatalog.some((seed) => seed.id === item.id));
  return [...merged, ...custom];
}

export function loadEquipment() {
  if (!canUseStorage()) return equipmentCatalog;

  try {
    const raw = window.localStorage.getItem(getScopedLocalStoreKey(localStoreKeys.equipment));
    if (!raw) return equipmentCatalog;
    const parsed = JSON.parse(raw) as Equipment[];
    return mergeWithSeed(parsed);
  } catch {
    return equipmentCatalog;
  }
}

export function saveEquipment(equipment: Equipment[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    getScopedLocalStoreKey(localStoreKeys.equipment),
    JSON.stringify(equipment)
  );
  queueCloudSync();
}

export function resetEquipment() {
  if (!canUseStorage()) return equipmentCatalog;
  window.localStorage.removeItem(getScopedLocalStoreKey(localStoreKeys.equipment));
  queueCloudSync();
  return equipmentCatalog;
}

export function loadSettings() {
  if (!canUseStorage()) return defaultSettings;

  try {
    const raw = window.localStorage.getItem(getScopedLocalStoreKey(localStoreKeys.settings));
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<UserSettings>) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: UserSettings) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    getScopedLocalStoreKey(localStoreKeys.settings),
    JSON.stringify(settings)
  );
  queueCloudSync();
}

export function toggleMuscle(list: Muscle[], muscle: Muscle) {
  return list.includes(muscle)
    ? list.filter((item) => item !== muscle)
    : [...list, muscle];
}

function loadJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(getScopedLocalStoreKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(getScopedLocalStoreKey(key), JSON.stringify(value));
  queueCloudSync();
}

export function loadBodyGoalProfile() {
  return {
    ...defaultBodyGoalProfile,
    ...loadJson<Partial<BodyGoalProfile>>(localStoreKeys.bodyGoal, {})
  };
}

export function saveBodyGoalProfile(profile: BodyGoalProfile) {
  saveJson(localStoreKeys.bodyGoal, profile);
}

export function loadDailyCheckIns() {
  return loadJson<Record<string, DailyCheckIn>>(localStoreKeys.checkIns, {});
}

export function loadDailyCheckIn(date = todayKey()) {
  const checkIns = loadDailyCheckIns();
  return { ...makeDefaultCheckIn(date), ...(checkIns[date] ?? {}) };
}

export function saveDailyCheckIn(checkIn: DailyCheckIn) {
  const checkIns = loadDailyCheckIns();
  saveJson(localStoreKeys.checkIns, { ...checkIns, [checkIn.date]: checkIn });
}

export function loadBodyCompositions() {
  return loadJson<BodyComposition[]>(localStoreKeys.bodyCompositions, []);
}

export function saveBodyCompositions(records: BodyComposition[]) {
  saveJson(localStoreKeys.bodyCompositions, records);
}

export function loadNutritionProfile() {
  return {
    ...defaultNutritionProfile,
    ...loadJson<Partial<NutritionProfile>>(localStoreKeys.nutritionProfile, {})
  };
}

export function saveNutritionProfile(profile: NutritionProfile) {
  saveJson(localStoreKeys.nutritionProfile, profile);
}

export function loadMealLogs(date = todayKey()) {
  return loadJson<MealLog[]>(localStoreKeys.mealLogs, []).filter((meal) =>
    meal.loggedAt.startsWith(date)
  );
}

export function saveMealLog(meal: MealLog) {
  saveJson(localStoreKeys.mealLogs, [
    ...loadJson<MealLog[]>(localStoreKeys.mealLogs, []),
    meal
  ]);
}

export function loadSupplements() {
  const stored = loadJson<UserSupplementProfile[]>(localStoreKeys.supplements, []);
  if (stored.length === 0) return defaultSupplements;
  return stored;
}

export function saveSupplements(supplements: UserSupplementProfile[]) {
  saveJson(localStoreKeys.supplements, supplements);
}

export function loadWorkoutLogs() {
  return loadJson<WorkoutSetLog[]>(localStoreKeys.workoutLogs, []);
}

export function saveWorkoutLogs(logs: WorkoutSetLog[]) {
  saveJson(localStoreKeys.workoutLogs, logs);
}

export function loadDailyPlanRevisions(date = todayKey()) {
  return loadJson<DailyPlanRevision[]>(localStoreKeys.dailyRevisions, []).filter(
    (revision) => revision.date === date
  );
}

export function loadLatestDailyPlanRevision(date = todayKey()) {
  return loadDailyPlanRevisions(date).sort((a, b) => b.revisionNumber - a.revisionNumber)[0] ?? null;
}

export function appendDailyPlanRevision(revision: Omit<DailyPlanRevision, "revisionNumber">) {
  const all = loadJson<DailyPlanRevision[]>(localStoreKeys.dailyRevisions, []);
  const revisionsForDate = all.filter((item) => item.date === revision.date);
  const next: DailyPlanRevision = {
    ...revision,
    revisionNumber: revisionsForDate.length + 1
  };
  saveJson(localStoreKeys.dailyRevisions, [...all, next]);
  return next;
}

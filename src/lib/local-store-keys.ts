export const localStoreKeys = {
  equipment: "adfc_equipment_v1",
  settings: "adfc_settings_v1",
  bodyGoal: "adfc_body_goal_v1",
  checkIns: "adfc_daily_check_ins_v1",
  bodyCompositions: "adfc_body_compositions_v1",
  nutritionProfile: "adfc_nutrition_profile_v1",
  mealLogs: "adfc_meal_logs_v1",
  supplements: "adfc_supplements_v1",
  workoutLogs: "adfc_workout_logs_v1",
  dailyRevisions: "adfc_daily_revisions_v1",
  workoutSession: "adfc_workout_session_v1",
  mealDraft: "adfc_meal_draft_v1",
  favoriteMeals: "adfc_favorite_meals_v1",
  cloudSyncMeta: "adfc_cloud_sync_meta_v1"
} as const;

export const appLocalStorageKeys = [
  localStoreKeys.equipment,
  localStoreKeys.settings,
  localStoreKeys.bodyGoal,
  localStoreKeys.checkIns,
  localStoreKeys.bodyCompositions,
  localStoreKeys.nutritionProfile,
  localStoreKeys.mealLogs,
  localStoreKeys.supplements,
  localStoreKeys.workoutLogs,
  localStoreKeys.dailyRevisions,
  localStoreKeys.workoutSession,
  localStoreKeys.mealDraft,
  localStoreKeys.favoriteMeals
] as const;

"use client";

import type {
  DailyCheckIn,
  DailyPlanRevision,
  DailyTrainingDecision,
  UserSupplementProfile
} from "@/lib/daily-types";
import {
  buildDailyTrainingContext,
  generateFallbackTrainingDecision,
  validateDailyTrainingDecision
} from "@/lib/daily-planning";
import {
  loadBodyCompositions,
  loadBodyGoalProfile,
  loadDailyCheckIn,
  loadEquipment,
  loadMealLogs,
  loadNutritionProfile,
  loadSettings,
  loadSupplements,
  loadWorkoutLogs,
  todayKey
} from "@/lib/local-store";
import { calculateDailyNutritionPlan } from "@/lib/nutrition";
import {
  generateWorkoutPlanFromDecision
} from "@/lib/workout-engine";
import {
  emptyWorkoutInput,
  type Equipment,
  type Muscle,
  type UserSettings
} from "@/lib/types";

export interface DailyPlanningState {
  date: string;
  equipment: Equipment[];
  settings: UserSettings;
  checkIn: DailyCheckIn;
  goal: ReturnType<typeof loadBodyGoalProfile>;
  bodyCompositions: ReturnType<typeof loadBodyCompositions>;
  nutritionProfile: ReturnType<typeof loadNutritionProfile>;
  meals: ReturnType<typeof loadMealLogs>;
  supplements: UserSupplementProfile[];
  workoutLogs: ReturnType<typeof loadWorkoutLogs>;
}

export function loadDailyPlanningState(date = todayKey()): DailyPlanningState {
  return {
    date,
    equipment: loadEquipment(),
    settings: loadSettings(),
    checkIn: loadDailyCheckIn(date),
    goal: loadBodyGoalProfile(),
    bodyCompositions: loadBodyCompositions(),
    nutritionProfile: loadNutritionProfile(),
    meals: loadMealLogs(date),
    supplements: loadSupplements(),
    workoutLogs: loadWorkoutLogs()
  };
}

export function buildDailyPlanSnapshot(
  state: DailyPlanningState,
  decisionOverride?: DailyTrainingDecision | null
) {
  const context = buildDailyTrainingContext({
    checkIn: state.checkIn,
    goal: state.goal,
    settings: state.settings,
    equipment: state.equipment,
    workoutLogs: state.workoutLogs,
    bodyCompositions: state.bodyCompositions,
    mealLogs: state.meals,
    nutritionProfile: state.nutritionProfile
  });
  const decision = decisionOverride
    ? validateDailyTrainingDecision(decisionOverride, context)
    : generateFallbackTrainingDecision(context);
  const input = {
    ...emptyWorkoutInput,
    workoutType: "full_body" as const,
    availableMinutes: state.checkIn.availableTimeMinutes,
    intensity: decision.overallIntensity,
    equipmentPreference: state.settings.defaultEquipmentPreference,
    soreMuscles: state.settings.soreMuscles.filter((muscle): muscle is Muscle => Boolean(muscle)),
    temporarilyUnavailableEquipmentIds: context.hardConstraints.unavailableEquipmentIds,
    avoidedEquipmentIds: context.hardConstraints.disabledEquipmentIds,
    recentExerciseIds: state.workoutLogs.slice(-12).map((log) => log.exerciseId)
  };
  const plan = generateWorkoutPlanFromDecision({
    decision,
    input,
    equipment: state.equipment,
    forbiddenMuscles: context.hardConstraints.forbiddenMuscles,
    forbiddenMovementFamilies: context.hardConstraints.forbiddenMovementFamilies
  });
  const nutritionPlan = calculateDailyNutritionPlan({
    profile: state.nutritionProfile,
    goal: state.goal,
    checkIn: state.checkIn,
    decision,
    meals: state.meals,
    supplements: state.supplements
  });

  return { context, decision, input, plan, nutritionPlan };
}

export function buildDailyPlanSnapshotFromRevision(
  state: DailyPlanningState,
  revision?: DailyPlanRevision | null,
  options: { preserveNutrition?: boolean } = {}
) {
  const snapshot = buildDailyPlanSnapshot(
    state,
    revision?.trainingDecisionSnapshot ?? null
  );
  if (!revision) return snapshot;

  return {
    ...snapshot,
    decision: revision.trainingDecisionSnapshot ?? snapshot.decision,
    plan: revision.finalWorkoutPlanSnapshot ?? snapshot.plan,
    nutritionPlan: options.preserveNutrition === false
      ? snapshot.nutritionPlan
      : revision.nutritionPlanSnapshot
  };
}

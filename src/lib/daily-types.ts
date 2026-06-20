import type {
  EquipmentPreferenceMode,
  Intensity,
  MovementFamily,
  Muscle,
  TargetRegion,
  WorkoutPlan
} from "@/lib/types";

export const muscleGroups = {
  lower_body: ["quads", "hamstrings", "glutes", "calves"],
  upper_body: [
    "chest",
    "upper_chest",
    "lower_chest",
    "lats",
    "upper_back",
    "mid_back",
    "front_delt",
    "side_delt",
    "rear_delt",
    "biceps",
    "triceps"
  ],
  shoulders: ["front_delt", "side_delt", "rear_delt", "traps"],
  arms: ["biceps", "triceps", "forearms"],
  back: ["lats", "upper_back", "mid_back", "lower_back", "traps"]
} as const;

export type MuscleGroup = keyof typeof muscleGroups;
export type AvoidableBodyPart = Muscle | TargetRegion | MuscleGroup;
export type TrainingIntent = "train" | "rest";
export type MainBodyGoal =
  | "lean_muscular"
  | "aesthetic_v_taper"
  | "classic_physique"
  | "bulk_muscle_gain"
  | "body_recomposition"
  | "fat_loss"
  | "athletic_performance"
  | "lower_body_focus"
  | "balanced_health"
  | "custom";

export type PreferredTrainingStyle =
  | "machine_cable"
  | "balanced"
  | "strength"
  | "hypertrophy"
  | "low_fatigue";

export type DietAggressiveness = "conservative" | "moderate" | "aggressive";
export type CardioPreference = "minimal" | "moderate" | "high";

export type BodyMetricGoalType =
  | "body_weight_kg"
  | "body_fat_percentage"
  | "skeletal_muscle_mass_kg"
  | "skeletal_muscle_to_weight_ratio"
  | "waist_cm"
  | "custom";

export type BodyMetricGoalDirection = "at_least" | "at_most" | "target_range";

export interface BodyMetricGoal {
  id: string;
  type: BodyMetricGoalType;
  direction: BodyMetricGoalDirection;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  priority: "primary" | "secondary";
  enabled: boolean;
  createdAt: string;
  targetDate: string | null;
  notes: string | null;
}

export interface BodyGoalProgress {
  goalId: string;
  currentValue: number | null;
  targetValue: number | null;
  progressPercentage: number | null;
  remainingValue: number | null;
  status: "not_started" | "in_progress" | "achieved" | "insufficient_data";
  latestMeasuredAt: string | null;
  confidence: "low" | "medium" | "high";
  scenarios: {
    label: string;
    description: string;
  }[];
  warnings: string[];
}

export type EquipmentMixMode =
  | "adaptive_balanced"
  | "machine_dominant"
  | "free_weight_dominant"
  | "machine_only"
  | "custom";

export interface PersonalTrainingStyleProfile {
  equipmentMixMode: EquipmentMixMode;
  targetFreeWeightExerciseShareMin: number;
  targetFreeWeightExerciseShareMax: number;
  targetMachineCableExerciseShareMin: number;
  targetMachineCableExerciseShareMax: number;
  typicalWorkingSetsPerExerciseMin: number;
  typicalWorkingSetsPerExerciseMax: number;
  historicalMedianExerciseCount: number | null;
  historicalMedianWorkingSets: number | null;
  historicalMedianTotalRecordedSets: number | null;
  historicalMedianDurationMinutes: number | null;
  historicalMedianSecondsPerRecordedSet: number | null;
  historicalMedianMinutesPerExercise: number | null;
  volumePreference: "low" | "moderate" | "high" | "adaptive";
  updatedAt: string;
}

export type RecoveryStatus = "poor" | "limited" | "normal" | "fresh";

export interface SessionVolumePrescription {
  targetExerciseCount: number;
  minExerciseCount: number;
  maxExerciseCount: number;
  targetWorkingSetCount: number;
  minWorkingSetCount: number;
  maxWorkingSetCount: number;
  plannedWarmupSetCount: number;
  targetTotalRecordedSetCount: number;
  targetDurationMinutes: number;
  volumeMultiplier: number;
}

export interface SessionFocusPolicy {
  primaryMuscles: string[];
  allowedAccessoryMuscles: string[];
  blockedOutOfFocusMuscles: string[];
  allowedMovementFamilies: MovementFamily[];
  maxAccessoryExerciseCount: number;
  maxAccessorySetRatio: number;
  allowFullBodyCompletion: boolean;
}

export type ExerciseRole =
  | "primary_compound"
  | "secondary_compound"
  | "unilateral_compound"
  | "primary_isolation"
  | "secondary_isolation"
  | "accessory"
  | "stability"
  | "rehab";

export type ExerciseModality = "machine" | "cable" | "barbell" | "dumbbell" | "smith_machine" | "bodyweight" | "accessory";

export interface WarmupSetPrescription {
  kind: "warmup";
  weightKg: number | null;
  reps: number;
  note: string;
}

export interface DailyMuscleDecision {
  sessionTitle: string;
  selectedMuscles: {
    muscle: string;
    priority: number;
    targetEffectiveSets: number;
    reason: string;
  }[];
  excludedMuscles: {
    muscle: string;
    reason: string;
  }[];
  bodyGoalContribution: {
    goalId: string;
    explanation: string;
  }[];
  overallIntensity: "low" | "normal" | "high";
  estimatedDurationMinutes: number;
  summaryReasons: string[];
  confidence: "low" | "medium" | "high";
}

export type ScheduleActivityType =
  | "long_walk"
  | "running"
  | "hiking"
  | "sports"
  | "prolonged_standing"
  | "physical_labor"
  | "important_upper_body_activity"
  | "important_lower_body_activity"
  | "custom";

export interface BodyGoalProfile {
  id: string;
  mainBodyGoal: MainBodyGoal;
  priorityMuscles: AvoidableBodyPart[];
  avoidOverdevelopmentMuscles: AvoidableBodyPart[];
  targetBodyWeightKg: number | null;
  targetBodyFatPercentage: number | null;
  targetSkeletalMuscleMassKg: number | null;
  preferredTrainingStyle: PreferredTrainingStyle;
  dietAggressiveness: DietAggressiveness;
  cardioPreference: CardioPreference;
  weeklyWeightChangeTargetKg: number | null;
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface WorkoutSessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  exerciseId: string;
  setType: "warmup" | "working";
  completedAt: string | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  wasCompleted: boolean;
}

export interface ScheduleConstraint {
  id: string;
  date: string;
  activityType: ScheduleActivityType;
  expectedDurationMinutes: number;
  intensity: Intensity;
  affectedMuscles: AvoidableBodyPart[];
  memo: string;
}

export interface DailyCheckIn {
  date: string;
  trainingIntent: TrainingIntent;
  bedTime: string;
  wakeTime: string;
  sleepQuality: number;
  conditionScore: number;
  sorenessMuscles: AvoidableBodyPart[];
  sorenessLevel: Record<string, number>;
  painMuscles: AvoidableBodyPart[];
  painLevel: Record<string, number>;
  avoidMusclesToday: AvoidableBodyPart[];
  scheduleConstraints: ScheduleConstraint[];
  availableTimeMinutes: number;
  preferredWorkoutStartTime: string;
  memo: string;
}

export interface WorkoutSetLog {
  id: string;
  performedAt: string;
  exerciseId: string;
  equipmentId: string;
  weight: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  isFailure: boolean;
  wasCompleted: boolean;
  wasSkipped: boolean;
  replacementReason: string | null;
  notes: string;
}

export interface WorkoutSessionRecord {
  id: string;
  localDate: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  planRevisionId: string | null;
  sessionTitle: string;
  focusMuscles: string[];
  exerciseIds: string[];
  totalWorkingSets: number;
  completedWorkingSets: number;
  totalVolumeKg: number;
  notes: string;
}

export interface WorkoutSessionExerciseRecord {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  plannedSets: number;
  plannedRepMin: number;
  plannedRepMax: number;
  plannedRestSeconds: number;
}

export interface WorkoutSetRecord {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  exerciseId: string;
  setIndex: number;
  setType: "warmup" | "working";
  targetWeightKg: number | null;
  actualWeightKg: number | null;
  targetReps: number | null;
  actualReps: number | null;
  rir: number | null;
  rpe: number | null;
  restSeconds: number | null;
  completedAt: string | null;
  wasCompleted: boolean;
  wasSkipped: boolean;
  notes: string;
}

export interface ExerciseMuscleContribution {
  exerciseId: string;
  muscle: AvoidableBodyPart;
  role: "primary" | "secondary";
  contributionWeight: number;
}

export interface MuscleHistorySummary {
  muscle: string;
  effectiveSetsLast7Days: number;
  effectiveSetsLast14Days: number;
  effectiveSetsLast28Days: number;
  targetEffectiveSetsPerWeek: number;
  weeklyVolumeDeficit: number;
  lastTrainedAt: string | null;
  hoursSinceLastTraining: number | null;
  averageRpe: number | null;
  averageRir: number | null;
  sorenessLevel: number;
  painLevel: number;
  recoveryScore: number;
  performanceTrend: "up" | "stable" | "down" | "insufficient_data";
}

export interface MovementHistorySummary {
  movementFamily: MovementFamily;
  effectiveSetsLast7Days: number;
  lastTrainedAt: string | null;
  recoveryScore: number;
}

export interface ExercisePerformanceTrend {
  exerciseId: string;
  totalLogs: number;
  recentThreeVolumeLoads: number[];
  estimatedOneRepMaxTrend: "up" | "stable" | "down" | "insufficient_data";
  isStalled: boolean;
  isImproving: boolean;
  skipCount: number;
  unavailableCount: number;
}

export interface BodyComposition {
  measuredAt: string;
  device: string | null;
  weightKg: number | null;
  skeletalMuscleMassKg: number | null;
  muscleMassKg: number | null;
  bodyFatMassKg: number | null;
  bmi: number | null;
  bodyFatPercentage: number | null;
  basalMetabolicRateKcal: number | null;
  inBodyScore: number | null;
  rightArmMuscleKg: number | null;
  leftArmMuscleKg: number | null;
  trunkMuscleKg: number | null;
  rightLegMuscleKg: number | null;
  leftLegMuscleKg: number | null;
  totalBodyWaterL: number | null;
  intracellularWaterL: number | null;
  extracellularWaterL: number | null;
  extracellularWaterRatio: number | null;
  waistCircumferenceCm: number | null;
  visceralFatAreaCm2: number | null;
  visceralFatLevel: number | null;
  raw: Record<string, string | number | null>;
}

export interface InBodyTrendSummary {
  status: "ok" | "insufficient_data";
  recordCount: number;
  latest: BodyComposition | null;
  previous: BodyComposition | null;
  confidence: "low" | "medium" | "high";
  weightChangeKg: number | null;
  skeletalMuscleMassChangeKg: number | null;
  skeletalMuscleToWeightRatio: number | null;
  skeletalMuscleToWeightRatioChange: number | null;
  bodyFatMassChangeKg: number | null;
  bodyFatPercentageChange: number | null;
  fourWeekAverages: {
    weightKg: number | null;
    skeletalMuscleMassKg: number | null;
    bodyFatMassKg: number | null;
    bodyFatPercentage: number | null;
  };
  armMuscleImbalanceKg: number | null;
  legMuscleImbalanceKg: number | null;
  hydrationNote: string;
  summary: string[];
}

export interface NutritionProfile {
  startingTargetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  mealCount: number;
  breakfastEnabled: boolean;
  lunchEnabled: boolean;
  dinnerEnabled: boolean;
  snackEnabled: boolean;
  preferredMealTimes: Record<string, string>;
  foodPreferences: string[];
  dislikedFoods: string[];
  allergies: string[];
  dietaryRestrictions: string[];
  workoutMealTimingPreference: "pre_workout_carbs" | "post_workout_carbs" | "even_distribution";
}

export interface MealLog {
  id: string;
  loggedAt: string;
  mealName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  memo: string;
}

export interface NutritionStatus {
  consumedCalories: number;
  consumedProteinG: number;
  consumedCarbsG: number;
  consumedFatG: number;
  remainingMeals: string[];
  notes: string[];
}

export interface DailyNutritionPlan {
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealTargets: Record<
    string,
    {
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
    }
  >;
  preWorkoutCarbsG: number;
  postWorkoutCarbsG: number;
  supplementChecklist: string[];
  notes: string[];
}

export interface UserSupplementProfile {
  id: string;
  supplementName: string;
  enabled: boolean;
  userConfiguredDose: string;
  preferredTiming: string;
  frequency: string;
  notes: string;
}

export interface AvailableMovementCapability {
  movementFamily: MovementFamily;
  targetRegions: string[];
  primaryMuscles: string[];
  equipmentTypes: string[];
}

export interface DailyTrainingContext {
  date: string;
  trainingIntent: TrainingIntent;
  bodyGoalProfile: BodyGoalProfile;
  sleepSummary: {
    durationMinutes: number;
    quality: number;
    conditionScore: number;
  };
  availableTimeMinutes: number;
  hardConstraints: {
    forbiddenMuscles: string[];
    forbiddenMovementFamilies: MovementFamily[];
    painMuscles: string[];
    disabledEquipmentIds: string[];
    unavailableEquipmentIds: string[];
    equipmentMode: EquipmentPreferenceMode;
  };
  scheduleConstraints: ScheduleConstraint[];
  muscleHistory: MuscleHistorySummary[];
  movementHistory: MovementHistorySummary[];
  exercisePerformanceTrends: ExercisePerformanceTrend[];
  inBodyTrend: InBodyTrendSummary;
  nutritionStatus: NutritionStatus;
  availableMovementCapabilities: AvailableMovementCapability[];
}

export interface DailyTrainingDecision {
  sessionMode: "strength" | "light_recovery" | "rest_recommended";
  sessionTitle: string;
  primaryFocusMuscles?: string[];
  allowedAccessoryMuscles?: string[];
  blockedMuscles?: string[];
  sessionArchetype?: string;
  selectedMuscles: {
    muscle: string;
    priority: number;
    targetEffectiveSets: number;
    reason: string;
  }[];
  excludedMuscles: {
    muscle: string;
    reason: string;
  }[];
  movementSlots: {
    slotId: string;
    primaryMuscle: string;
    targetRegion: string | null;
    movementFamily: MovementFamily;
    targetSets: number;
    repMin: number;
    repMax: number;
    intensity: Intensity;
    priority: number;
    reason: string;
  }[];
  overallIntensity: Intensity;
  volumeMultiplier: number;
  volumePrescription?: SessionVolumePrescription;
  estimatedDurationMinutes: number;
  evidenceKeys: string[];
  reasoningSummary: string[];
  warnings: string[];
  confidence: "low" | "medium" | "high";
  requiresUserConfirmation: boolean;
  fallbackUsed?: boolean;
}

export interface DailyPlanRevision {
  id: string;
  date: string;
  revisionNumber: number;
  triggerType: string;
  triggerPayload: unknown;
  trainingDecisionSnapshot: DailyTrainingDecision | null;
  finalWorkoutPlanSnapshot: WorkoutPlan | null;
  nutritionPlanSnapshot: DailyNutritionPlan;
  createdAt: string;
}

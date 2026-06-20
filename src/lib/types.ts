export const equipmentTypes = [
  "machine",
  "cable",
  "barbell",
  "dumbbell",
  "bodyweight",
  "smith_machine",
  "cardio",
  "accessory"
] as const;

export const loadTypes = [
  "plate_loaded",
  "selectorized",
  "cable_stack",
  "free_weight",
  "bodyweight",
  "assisted",
  "unknown"
] as const;

export const movementFamilies = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "knee_extension",
  "knee_flexion",
  "hip_abduction",
  "hip_adduction",
  "elbow_flexion",
  "elbow_extension",
  "shoulder_abduction",
  "shoulder_extension",
  "fly",
  "core",
  "cardio"
] as const;

export const muscles = [
  "chest",
  "triceps",
  "front_delt",
  "side_delt",
  "rear_delt",
  "lats",
  "upper_back",
  "mid_back",
  "lower_back",
  "traps",
  "biceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "obliques",
  "adductors",
  "abductors",
  "cardio"
] as const;

export const targetRegions = [
  "upper_chest",
  "mid_chest",
  "lower_chest",
  "front_delt",
  "side_delt",
  "rear_delt",
  "lats",
  "upper_back",
  "mid_back",
  "lower_back",
  "traps",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "obliques",
  "adductors",
  "abductors",
  "cardio"
] as const;

export const angles = [
  "flat",
  "incline",
  "decline",
  "vertical",
  "horizontal",
  "high_to_low",
  "low_to_high",
  "neutral",
  "rotational"
] as const;

export const fatigueScores = ["low", "medium", "medium_high", "high"] as const;
export const setupDifficulties = ["low", "medium", "high"] as const;
export const stabilityLevels = ["low", "medium", "high"] as const;
export const userPreferences = ["preferred", "neutral", "avoid", "disabled"] as const;
export const technicalDifficulties = ["low", "medium", "high"] as const;
export const progressionTypes = [
  "load",
  "reps",
  "tempo",
  "range_of_motion",
  "duration"
] as const;

export type EquipmentType = (typeof equipmentTypes)[number];
export type LoadType = (typeof loadTypes)[number];
export type MovementFamily = (typeof movementFamilies)[number];
export type Muscle = (typeof muscles)[number];
export type TargetRegion = (typeof targetRegions)[number];
export type Angle = (typeof angles)[number];
export type FatigueScore = (typeof fatigueScores)[number];
export type SetupDifficulty = (typeof setupDifficulties)[number];
export type StabilityLevel = (typeof stabilityLevels)[number];
export type UserPreference = (typeof userPreferences)[number];
export type TechnicalDifficulty = (typeof technicalDifficulties)[number];
export type ProgressionType = (typeof progressionTypes)[number];

export type WorkoutType =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "rest";

export type Intensity = "low" | "normal" | "high";

export type EquipmentPreferenceMode =
  | "machine_only"
  | "machine_cable_priority"
  | "free_weight_allowed";

export interface Equipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  equipment_type: EquipmentType;
  load_type: LoadType;
  primary_muscles: Muscle[];
  secondary_muscles: Muscle[];
  target_regions: TargetRegion[];
  movement_patterns: string[];
  movement_family: MovementFamily[];
  angle: Angle | "mixed";
  is_unilateral: boolean;
  is_plate_loaded: boolean;
  is_selectorized: boolean;
  is_cable: boolean;
  stability_level: StabilityLevel;
  fatigue_score: FatigueScore;
  setup_difficulty: SetupDifficulty;
  handles_grips: string[];
  notes: string;
  user_preference: UserPreference;
  is_available: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  primary_muscle: Muscle;
  secondary_muscles: Muscle[];
  target_region: TargetRegion;
  movement_pattern: string;
  movement_family: MovementFamily;
  required_equipment_ids: string[];
  equipment_requirement?: {
    allOf: string[];
    oneOfGroups: string[][];
  };
  compatible_equipment_categories: string[];
  equipment_type_preference: EquipmentType[];
  exercise_role?:
    | "primary_compound"
    | "secondary_compound"
    | "unilateral_compound"
    | "primary_isolation"
    | "secondary_isolation"
    | "accessory"
    | "stability"
    | "rehab";
  default_sets: number;
  default_rep_min: number;
  default_rep_max: number;
  default_warmup_sets?: number;
  default_rest_seconds: number;
  fatigue_score: FatigueScore;
  technical_difficulty: TechnicalDifficulty;
  progression_type: ProgressionType;
  default_weight_lbs?: number;
  notes: string;
}

export interface WorkoutSlot {
  id: string;
  label: string;
  primary_muscle?: Muscle;
  secondary_muscles?: Muscle[];
  target_region?: TargetRegion;
  movement_family: MovementFamily;
  movement_pattern?: string;
  priority: number;
}

export interface GenerateWorkoutInput {
  workoutType: WorkoutType;
  availableMinutes: number;
  intensity: Intensity;
  equipmentPreference: EquipmentPreferenceMode;
  soreMuscles: Muscle[];
  temporarilyUnavailableEquipmentIds: string[];
  avoidedEquipmentIds: string[];
  recentExerciseIds: string[];
}

export interface ExerciseScore {
  exercise: Exercise;
  equipment: Equipment[];
  score: number;
  reasons: string[];
}

export interface WorkoutPlanItem {
  id: string;
  slot: WorkoutSlot;
  exercise: Exercise;
  equipment: Equipment[];
  score: number;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  recommended_weight_lbs?: number;
  warmupSets?: Array<{
    kind: "warmup";
    weightKg: number | null;
    reps: number;
    note: string;
  }>;
  reason: string;
}

export interface WorkoutPlan {
  workoutType: WorkoutType;
  sessionTitle?: string;
  focusMuscles?: string[];
  decisionSummary?: string[];
  generatedAt: string;
  availableMinutes: number;
  intensity: Intensity;
  items: WorkoutPlanItem[];
  skippedSlots: WorkoutSlot[];
  volumePrescription?: import("@/lib/daily-types").SessionVolumePrescription;
  notes: string[];
}

export interface UserSettings {
  defaultAvailableMinutes: number;
  defaultIntensity: Intensity;
  defaultEquipmentPreference: EquipmentPreferenceMode;
  soreMuscles: Muscle[];
}

export const workoutLabels: Record<WorkoutType, string> = {
  push: "푸시",
  pull: "풀",
  legs: "하체",
  upper: "상체",
  lower: "하체 집중",
  full_body: "전신",
  rest: "휴식"
};

export const preferenceLabels: Record<UserPreference, string> = {
  preferred: "선호",
  neutral: "보통",
  avoid: "피하기",
  disabled: "비활성"
};

export const equipmentPreferenceLabels: Record<EquipmentPreferenceMode, string> = {
  machine_only: "머신만",
  machine_cable_priority: "머신 비중 높게",
  free_weight_allowed: "자동 균형"
};

export const emptyWorkoutInput: GenerateWorkoutInput = {
  workoutType: "full_body",
  availableMinutes: 70,
  intensity: "normal",
  equipmentPreference: "free_weight_allowed",
  soreMuscles: [],
  temporarilyUnavailableEquipmentIds: [],
  avoidedEquipmentIds: [],
  recentExerciseIds: []
};

import type {
  ExerciseModality,
  ExerciseRole,
  PersonalTrainingStyleProfile,
  RecoveryStatus,
  SessionVolumePrescription,
  WarmupSetPrescription,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet
} from "@/lib/daily-types";
import type { Exercise } from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export const defaultPersonalTrainingStyleProfile: PersonalTrainingStyleProfile = {
  equipmentMixMode: "adaptive_balanced",
  targetFreeWeightExerciseShareMin: 0.25,
  targetFreeWeightExerciseShareMax: 0.4,
  targetMachineCableExerciseShareMin: 0.6,
  targetMachineCableExerciseShareMax: 0.75,
  typicalWorkingSetsPerExerciseMin: 3,
  typicalWorkingSetsPerExerciseMax: 4,
  historicalMedianExerciseCount: 7,
  historicalMedianWorkingSets: 24,
  historicalMedianTotalRecordedSets: 25,
  historicalMedianDurationMinutes: 70.65,
  historicalMedianSecondsPerRecordedSet: 170,
  historicalMedianMinutesPerExercise: 10,
  volumePreference: "adaptive",
  updatedAt: "2026-06-20T00:00:00.000Z"
};

export function derivePersonalTrainingStyleProfile(
  completedSessions: WorkoutSession[],
  sessionExercises: WorkoutSessionExercise[],
  workoutSets: WorkoutSet[],
  exercises: Exercise[]
): PersonalTrainingStyleProfile {
  if (completedSessions.length === 0) return defaultPersonalTrainingStyleProfile;

  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const exerciseCounts = completedSessions.map(
    (session) => sessionExercises.filter((item) => item.sessionId === session.id).length
  );
  const workingSetCounts = completedSessions.map((session) =>
    workoutSets.filter(
      (set) => set.sessionId === session.id && set.setType === "working" && set.wasCompleted
    ).length
  );
  const totalSetCounts = completedSessions.map((session) =>
    workoutSets.filter((set) => set.sessionId === session.id && set.wasCompleted).length
  );
  const durations = completedSessions
    .map((session) => session.durationSeconds)
    .filter((value): value is number => value !== null)
    .map((seconds) => seconds / 60);
  const completedExerciseIds = sessionExercises.map((item) => item.exerciseId);
  const freeWeightCount = completedExerciseIds.filter((id) =>
    exerciseById.get(id)?.equipment_type_preference.some((type) =>
      ["barbell", "dumbbell"].includes(type)
    )
  ).length;
  const machineCableCount = completedExerciseIds.filter((id) =>
    exerciseById.get(id)?.equipment_type_preference.some((type) =>
      ["machine", "cable", "smith_machine"].includes(type)
    )
  ).length;
  const totalExercises = Math.max(1, completedExerciseIds.length);
  const freeShare = freeWeightCount / totalExercises;
  const machineShare = machineCableCount / totalExercises;
  const medianTotalSets = median(totalSetCounts);
  const medianDuration = median(durations);

  return {
    ...defaultPersonalTrainingStyleProfile,
    targetFreeWeightExerciseShareMin: clamp(freeShare - 0.08, 0.15, 0.45),
    targetFreeWeightExerciseShareMax: clamp(freeShare + 0.08, 0.25, 0.55),
    targetMachineCableExerciseShareMin: clamp(machineShare - 0.08, 0.45, 0.85),
    targetMachineCableExerciseShareMax: clamp(machineShare + 0.08, 0.55, 0.95),
    historicalMedianExerciseCount: median(exerciseCounts),
    historicalMedianWorkingSets: median(workingSetCounts),
    historicalMedianTotalRecordedSets: medianTotalSets,
    historicalMedianDurationMinutes: medianDuration,
    historicalMedianSecondsPerRecordedSet:
      medianDuration !== null && medianTotalSets !== null && medianTotalSets > 0
        ? Math.round((medianDuration * 60) / medianTotalSets)
        : defaultPersonalTrainingStyleProfile.historicalMedianSecondsPerRecordedSet,
    historicalMedianMinutesPerExercise:
      medianDuration !== null && median(exerciseCounts) !== null && median(exerciseCounts)! > 0
        ? Math.round((medianDuration / median(exerciseCounts)!) * 10) / 10
        : defaultPersonalTrainingStyleProfile.historicalMedianMinutesPerExercise,
    updatedAt: new Date().toISOString()
  };
}

function baseVolumeForTime(availableTimeMinutes: number) {
  if (availableTimeMinutes < 45) {
    return {
      minExerciseCount: 4,
      targetExerciseCount: 5,
      maxExerciseCount: 5,
      minWorkingSetCount: 11,
      targetWorkingSetCount: 13,
      maxWorkingSetCount: 15,
      plannedWarmupSetCount: 2
    };
  }
  if (availableTimeMinutes < 60) {
    return {
      minExerciseCount: 5,
      targetExerciseCount: 6,
      maxExerciseCount: 7,
      minWorkingSetCount: 16,
      targetWorkingSetCount: 19,
      maxWorkingSetCount: 22,
      plannedWarmupSetCount: 3
    };
  }
  if (availableTimeMinutes <= 75) {
    return {
      minExerciseCount: 6,
      targetExerciseCount: 7,
      maxExerciseCount: 8,
      minWorkingSetCount: 20,
      targetWorkingSetCount: 24,
      maxWorkingSetCount: 27,
      plannedWarmupSetCount: 3
    };
  }
  return {
    minExerciseCount: 7,
    targetExerciseCount: 8,
    maxExerciseCount: 9,
    minWorkingSetCount: 23,
    targetWorkingSetCount: 26,
    maxWorkingSetCount: 29,
    plannedWarmupSetCount: 4
  };
}

function readinessMultiplier(readinessScore: number, recoveryStatus: RecoveryStatus) {
  const readiness =
    readinessScore <= 3 ? 0.65 : readinessScore <= 5 ? 0.8 : readinessScore >= 9 ? 1.05 : 1;
  const recovery =
    recoveryStatus === "poor"
      ? 0.65
      : recoveryStatus === "limited"
        ? 0.8
        : recoveryStatus === "fresh"
          ? 1.05
          : 1;
  return clamp(readiness * recovery, 0.55, 1.1);
}

export function calculateSessionVolumePrescription(input: {
  availableTimeMinutes: number;
  readinessScore: number;
  recoveryStatus: RecoveryStatus;
  trainingStyleProfile: PersonalTrainingStyleProfile;
  selectedMuscles: string[];
  avoidMuscles: string[];
  painMuscles: string[];
}): SessionVolumePrescription {
  const base = baseVolumeForTime(input.availableTimeMinutes);
  const painPenalty = input.painMuscles.length > 0 ? 0.82 : 1;
  const muscleBreadth = input.selectedMuscles.length <= 1 ? 0.9 : input.selectedMuscles.length >= 4 ? 1.05 : 1;
  const multiplier = clamp(
    readinessMultiplier(input.readinessScore, input.recoveryStatus) * painPenalty * muscleBreadth,
    0.55,
    1.1
  );
  const targetExerciseCount = clamp(
    Math.round(base.targetExerciseCount * multiplier),
    Math.max(3, Math.round(base.minExerciseCount * multiplier)),
    base.maxExerciseCount
  );
  const minExerciseCount =
    multiplier < 0.8 ? Math.max(3, Math.round(base.minExerciseCount * multiplier)) : base.minExerciseCount;
  const targetWorkingSetCount = clamp(
    Math.round(base.targetWorkingSetCount * multiplier),
    Math.max(8, Math.round(base.minWorkingSetCount * multiplier)),
    base.maxWorkingSetCount
  );
  const minWorkingSetCount =
    multiplier < 0.8 ? Math.max(8, Math.round(base.minWorkingSetCount * multiplier)) : base.minWorkingSetCount;
  const plannedWarmupSetCount = Math.max(1, Math.round(base.plannedWarmupSetCount * Math.min(1, multiplier)));

  return {
    targetExerciseCount,
    minExerciseCount,
    maxExerciseCount: base.maxExerciseCount,
    targetWorkingSetCount,
    minWorkingSetCount,
    maxWorkingSetCount: base.maxWorkingSetCount,
    plannedWarmupSetCount,
    targetTotalRecordedSetCount: targetWorkingSetCount + plannedWarmupSetCount,
    targetDurationMinutes: input.availableTimeMinutes,
    volumeMultiplier: Math.round(multiplier * 100) / 100
  };
}

function scaleWeight(weight: number | null, multiplier: number) {
  if (weight === null || weight <= 0) return null;
  return Math.round(weight * multiplier * 2) / 2;
}

export function generateWarmupPrescription(input: {
  exercise: Exercise;
  role: ExerciseRole;
  modality: ExerciseModality;
  recommendedWorkingWeightKg: number | null;
  previousExercise: Exercise | null;
  musclesAlreadyWarmedUp: string[];
}): WarmupSetPrescription[] {
  const primaryAlreadyWarm = input.musclesAlreadyWarmedUp.includes(input.exercise.primary_muscle);
  const isFreeWeightCompound =
    ["barbell", "dumbbell"].includes(input.modality)
    && ["primary_compound", "secondary_compound", "unilateral_compound"].includes(input.role);
  const isMachineCompound =
    ["machine", "smith_machine"].includes(input.modality)
    && ["primary_compound", "secondary_compound"].includes(input.role);
  const isIsolation = input.role.includes("isolation") || input.role === "accessory";
  let count = 0;

  if (isFreeWeightCompound && !primaryAlreadyWarm) count = 3;
  else if (isFreeWeightCompound) count = 1;
  else if (isMachineCompound && !primaryAlreadyWarm) count = 2;
  else if (isMachineCompound) count = 1;
  else if (isIsolation && !primaryAlreadyWarm && input.exercise.fatigue_score !== "low") count = 1;

  if (count === 0) return [];

  const ramp =
    count >= 3
      ? [0.4, 0.65, 0.82]
      : count === 2
        ? [0.55, 0.78]
        : [0.6];

  return ramp.map((multiplier, index) => ({
    kind: "warmup" as const,
    weightKg: scaleWeight(input.recommendedWorkingWeightKg, multiplier),
    reps: index === 0 ? 10 : index === 1 ? 6 : 4,
    note: index === 0 ? "가볍게 움직임 확인" : "본세트 전 램핑"
  }));
}


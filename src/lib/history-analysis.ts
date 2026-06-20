import { exerciseCatalog } from "@/lib/exercise-data";
import { getLocalDateKey } from "@/lib/date";
import type {
  BodyGoalProfile,
  DailyCheckIn,
  ExerciseMuscleContribution,
  ExercisePerformanceTrend,
  MuscleHistorySummary,
  MovementHistorySummary,
  WorkoutSetLog
} from "@/lib/daily-types";
import {
  movementFamilies,
  muscles,
  targetRegions,
  type Exercise,
  type MovementFamily
} from "@/lib/types";

const localGroups: Record<string, string[]> = {
  lower_body: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"],
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
};

const trackedParts = Array.from(new Set([...muscles, ...targetRegions])).filter(
  (part) => part !== "cardio"
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hoursBetween(now: Date, past: string | null) {
  if (!past) return null;
  const timestamp = new Date(past).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now.getTime() - timestamp) / 36e5);
}

function isWithinDays(now: Date, date: string, days: number) {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return now.getTime() - timestamp <= days * 24 * 36e5;
}

function getLevel(map: Record<string, number>, explicitList: string[], part: string) {
  if (map[part] !== undefined) return map[part];
  return explicitList.includes(part) ? 5 : 0;
}

function expandGoalParts(parts: string[]) {
  return Array.from(
    new Set(parts.flatMap((part) => (localGroups[part] ? [part, ...localGroups[part]] : [part])))
  );
}

function targetSetsForPart(part: string, goal: BodyGoalProfile) {
  const priorityParts = expandGoalParts(goal.priorityMuscles);
  const avoidParts = expandGoalParts(goal.avoidOverdevelopmentMuscles);
  const largeMuscles = new Set(["chest", "lats", "upper_back", "mid_back", "quads", "hamstrings", "glutes"]);
  const vTaperParts = new Set(["side_delt", "rear_delt", "lats", "upper_back", "upper_chest"]);
  const lowerParts = new Set(["quads", "hamstrings", "glutes", "calves"]);

  if (avoidParts.includes(part)) return 4;
  if (priorityParts.includes(part)) return 13;
  if (goal.mainBodyGoal === "aesthetic_v_taper" && vTaperParts.has(part)) return 12;
  if (goal.mainBodyGoal === "lower_body_focus" && lowerParts.has(part)) return 13;
  if (goal.mainBodyGoal === "fat_loss") return 7;
  return largeMuscles.has(part) ? 10 : 8;
}

function isCompletedTrainingSet(log: WorkoutSetLog) {
  return log.wasCompleted && !log.wasSkipped && log.reps > 0;
}

function setEffectiveValue(log: WorkoutSetLog) {
  if (!isCompletedTrainingSet(log)) return 0;
  if (log.rpe !== null && log.rpe < 6) return 0.65;
  if (log.rir !== null && log.rir > 5) return 0.65;
  return 1;
}

function volumeLoad(log: WorkoutSetLog) {
  const weight = Number.isFinite(log.weight) && log.weight > 0 ? log.weight : 1;
  return Math.round(weight * Math.max(0, log.reps));
}

function estimatedOneRepMax(log: WorkoutSetLog) {
  if (!isCompletedTrainingSet(log) || log.weight <= 0) return null;
  return log.weight * (1 + log.reps / 30);
}

function trendFromNumbers(values: number[]) {
  if (values.length < 3) return "insufficient_data" as const;
  const first = values[0];
  const last = values[values.length - 1];
  if (first <= 0) return "insufficient_data" as const;
  const delta = (last - first) / first;
  if (delta > 0.04) return "up" as const;
  if (delta < -0.04) return "down" as const;
  return "stable" as const;
}

export function getExerciseMuscleContributions(
  exercises: Exercise[] = exerciseCatalog
): ExerciseMuscleContribution[] {
  return exercises.flatMap((exercise) => {
    const contributions: ExerciseMuscleContribution[] = [
      {
        exerciseId: exercise.id,
        muscle: exercise.primary_muscle,
        role: "primary",
        contributionWeight: 1
      }
    ];

    if (exercise.target_region !== exercise.primary_muscle) {
      contributions.push({
        exerciseId: exercise.id,
        muscle: exercise.target_region,
        role: "primary",
        contributionWeight: 1
      });
    }

    exercise.secondary_muscles.forEach((muscle) => {
      contributions.push({
        exerciseId: exercise.id,
        muscle,
        role: "secondary",
        contributionWeight: 0.45
      });
    });

    return contributions;
  });
}

export function analyzeExercisePerformanceTrends(
  logs: WorkoutSetLog[],
  exercises: Exercise[] = exerciseCatalog
): ExercisePerformanceTrend[] {
  return exercises.map((exercise) => {
    const exerciseLogs = logs
      .filter((log) => log.exerciseId === exercise.id)
      .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
    const completed = exerciseLogs.filter(isCompletedTrainingSet);
    const byDay = new Map<string, number>();
    const e1rms: number[] = [];

    completed.forEach((log) => {
      const key = getLocalDateKey(new Date(log.performedAt));
      byDay.set(key, (byDay.get(key) ?? 0) + volumeLoad(log));
      const e1rm = estimatedOneRepMax(log);
      if (e1rm !== null) e1rms.push(e1rm);
    });

    const recentThreeVolumeLoads = Array.from(byDay.values()).slice(-3);
    const estimatedOneRepMaxTrend = trendFromNumbers(e1rms.slice(-6));
    const skipCount = exerciseLogs.filter((log) => log.wasSkipped).length;
    const unavailableCount = exerciseLogs.filter((log) =>
      (log.replacementReason ?? "").toLowerCase().includes("unavailable")
      || (log.replacementReason ?? "").includes("사용 불가")
      || (log.replacementReason ?? "").includes("기구")
    ).length;

    return {
      exerciseId: exercise.id,
      totalLogs: exerciseLogs.length,
      recentThreeVolumeLoads,
      estimatedOneRepMaxTrend,
      isStalled:
        recentThreeVolumeLoads.length >= 3
        && recentThreeVolumeLoads[2] <= recentThreeVolumeLoads[0] * 1.01,
      isImproving:
        estimatedOneRepMaxTrend === "up"
        || (recentThreeVolumeLoads.length >= 3
          && recentThreeVolumeLoads[2] > recentThreeVolumeLoads[0] * 1.04),
      skipCount,
      unavailableCount
    };
  });
}

export function summarizeTrainingHistory({
  logs,
  checkIn,
  goal,
  exercises = exerciseCatalog,
  now = new Date()
}: {
  logs: WorkoutSetLog[];
  checkIn: DailyCheckIn;
  goal: BodyGoalProfile;
  exercises?: Exercise[];
  now?: Date;
}) {
  const contributions = getExerciseMuscleContributions(exercises);
  const contributionsByExercise = new Map<string, ExerciseMuscleContribution[]>();
  contributions.forEach((contribution) => {
    const current = contributionsByExercise.get(contribution.exerciseId) ?? [];
    current.push(contribution);
    contributionsByExercise.set(contribution.exerciseId, current);
  });

  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const performanceTrends = analyzeExercisePerformanceTrends(logs, exercises);
  const trendByExercise = new Map(performanceTrends.map((trend) => [trend.exerciseId, trend]));

  const muscleHistory = trackedParts.map((part): MuscleHistorySummary => {
    const partLogs = logs.filter((log) =>
      (contributionsByExercise.get(log.exerciseId) ?? []).some(
        (contribution) => contribution.muscle === part
      )
    );
    const completed = partLogs.filter(isCompletedTrainingSet);
    const weightedSets = (days: number) =>
      completed.reduce((total, log) => {
        if (!isWithinDays(now, log.performedAt, days)) return total;
        const contribution =
          (contributionsByExercise.get(log.exerciseId) ?? []).find(
            (item) => item.muscle === part
          )?.contributionWeight ?? 0;
        return total + setEffectiveValue(log) * contribution;
      }, 0);

    const lastTrainedAt = completed.at(-1)?.performedAt ?? null;
    const hoursSinceLastTraining = hoursBetween(now, lastTrainedAt);
    const targetEffectiveSetsPerWeek = targetSetsForPart(part, goal);
    const effectiveSetsLast7Days = Math.round(weightedSets(7) * 10) / 10;
    const sorenessLevel = getLevel(
      checkIn.sorenessLevel,
      checkIn.sorenessMuscles.map(String),
      part
    );
    const painLevel = getLevel(checkIn.painLevel, checkIn.painMuscles.map(String), part);
    const volumeRatio = effectiveSetsLast7Days / Math.max(1, targetEffectiveSetsPerWeek);
    const baseRecovery =
      hoursSinceLastTraining === null
        ? 88
        : hoursSinceLastTraining < 24
          ? 42
          : hoursSinceLastTraining < 48
            ? 58
            : hoursSinceLastTraining < 72
              ? 74
              : 88;
    const recoveryScore = clamp(
      baseRecovery - sorenessLevel * 8 - painLevel * 12 - Math.max(0, volumeRatio - 1) * 18,
      0,
      100
    );
    const relevantTrends = Array.from(
      new Set(partLogs.map((log) => log.exerciseId).filter((id) => exerciseById.has(id)))
    )
      .map((id) => trendByExercise.get(id))
      .filter((trend): trend is ExercisePerformanceTrend => Boolean(trend));
    const trend =
      relevantTrends.length === 0
        ? "insufficient_data"
        : relevantTrends.some((item) => item.isImproving)
          ? "up"
          : relevantTrends.some((item) => item.estimatedOneRepMaxTrend === "down")
            ? "down"
            : "stable";

    const rpeValues = completed
      .map((log) => log.rpe)
      .filter((value): value is number => value !== null);
    const rirValues = completed
      .map((log) => log.rir)
      .filter((value): value is number => value !== null);

    return {
      muscle: part,
      effectiveSetsLast7Days,
      effectiveSetsLast14Days: Math.round(weightedSets(14) * 10) / 10,
      effectiveSetsLast28Days: Math.round(weightedSets(28) * 10) / 10,
      targetEffectiveSetsPerWeek,
      weeklyVolumeDeficit: Math.max(
        0,
        Math.round((targetEffectiveSetsPerWeek - effectiveSetsLast7Days) * 10) / 10
      ),
      lastTrainedAt,
      hoursSinceLastTraining:
        hoursSinceLastTraining === null ? null : Math.round(hoursSinceLastTraining),
      averageRpe:
        rpeValues.length === 0
          ? null
          : Math.round((rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) * 10)
            / 10,
      averageRir:
        rirValues.length === 0
          ? null
          : Math.round((rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length) * 10)
            / 10,
      sorenessLevel,
      painLevel,
      recoveryScore: Math.round(recoveryScore),
      performanceTrend: trend
    };
  });

  const movementHistory = movementFamilies.map((movementFamily): MovementHistorySummary => {
    const movementLogs = logs.filter(
      (log) => exerciseById.get(log.exerciseId)?.movement_family === movementFamily
    );
    const completed = movementLogs.filter(isCompletedTrainingSet);
    const effectiveSetsLast7Days = completed.reduce(
      (total, log) => total + (isWithinDays(now, log.performedAt, 7) ? setEffectiveValue(log) : 0),
      0
    );
    const lastTrainedAt = completed.at(-1)?.performedAt ?? null;
    const hours = hoursBetween(now, lastTrainedAt);
    const recoveryScore =
      hours === null ? 88 : clamp(hours < 24 ? 45 : hours < 48 ? 62 : hours < 72 ? 76 : 90, 0, 100);

    return {
      movementFamily: movementFamily as MovementFamily,
      effectiveSetsLast7Days: Math.round(effectiveSetsLast7Days * 10) / 10,
      lastTrainedAt,
      recoveryScore: Math.round(recoveryScore)
    };
  });

  return {
    muscleHistory,
    movementHistory,
    exercisePerformanceTrends: performanceTrends
  };
}

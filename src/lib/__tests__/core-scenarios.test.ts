import assert from "node:assert/strict";
import type {
  BodyComposition,
  BodyGoalProfile,
  DailyCheckIn,
  MealLog,
  NutritionProfile,
  WorkoutSetLog
} from "@/lib/daily-types";
import {
  buildDailyTrainingContext,
  generateFallbackTrainingDecision,
  validateDailyTrainingDecision
} from "@/lib/daily-planning";
import { equipmentCatalog } from "@/lib/equipment-data";
import { exerciseCatalog } from "@/lib/exercise-data";
import { getInBodyTrendSummary, parseInBodyCsv } from "@/lib/inbody";
import { calculateDailyNutritionPlan } from "@/lib/nutrition";
import type { EquipmentPreferenceMode, UserSettings } from "@/lib/types";
import { generateWorkoutPlanFromDecision } from "@/lib/workout-engine";

const now = new Date("2026-06-20T09:00:00+09:00");
const date = "2026-06-20";
const lowerMuscles = new Set(["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"]);

function goal(overrides: Partial<BodyGoalProfile> = {}): BodyGoalProfile {
  return {
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
    notes: "",
    ...overrides
  };
}

function checkIn(overrides: Partial<DailyCheckIn> = {}): DailyCheckIn {
  return {
    date,
    trainingIntent: "train",
    bedTime: "23:30",
    wakeTime: "07:30",
    sleepQuality: 4,
    conditionScore: 8,
    sorenessMuscles: [],
    sorenessLevel: {},
    painMuscles: [],
    painLevel: {},
    avoidMusclesToday: [],
    scheduleConstraints: [],
    availableTimeMinutes: 60,
    preferredWorkoutStartTime: "18:30",
    memo: "",
    ...overrides
  };
}

function settings(equipmentPreference: EquipmentPreferenceMode): UserSettings {
  return {
    defaultAvailableMinutes: 60,
    defaultIntensity: "normal",
    defaultEquipmentPreference: equipmentPreference,
    soreMuscles: []
  };
}

function nutritionProfile(overrides: Partial<NutritionProfile> = {}): NutritionProfile {
  return {
    startingTargetCalories: 2200,
    targetProteinG: 160,
    targetCarbsG: 220,
    targetFatG: 65,
    mealCount: 4,
    breakfastEnabled: true,
    lunchEnabled: true,
    dinnerEnabled: true,
    snackEnabled: true,
    preferredMealTimes: {},
    foodPreferences: [],
    dislikedFoods: [],
    allergies: [],
    dietaryRestrictions: [],
    workoutMealTimingPreference: "pre_workout_carbs",
    ...overrides
  };
}

function setLog(
  index: number,
  exerciseId: string,
  equipmentId: string,
  daysAgo: number,
  overrides: Partial<WorkoutSetLog> = {}
): WorkoutSetLog {
  const performedAt = new Date(now.getTime() - daysAgo * 24 * 36e5).toISOString();
  return {
    id: `log-${index}`,
    performedAt,
    exerciseId,
    equipmentId,
    weight: 100,
    reps: 10,
    rir: 2,
    rpe: 8,
    isFailure: false,
    wasCompleted: true,
    wasSkipped: false,
    replacementReason: null,
    notes: "",
    ...overrides
  };
}

function buildContext({
  dailyCheckIn = checkIn(),
  bodyGoal = goal(),
  workoutLogs = [],
  meals = [],
  profile = nutritionProfile(),
  equipmentPreference = "machine_cable_priority" as EquipmentPreferenceMode,
  bodyCompositions = []
}: {
  dailyCheckIn?: DailyCheckIn;
  bodyGoal?: BodyGoalProfile;
  workoutLogs?: WorkoutSetLog[];
  meals?: MealLog[];
  profile?: NutritionProfile;
  equipmentPreference?: EquipmentPreferenceMode;
  bodyCompositions?: BodyComposition[];
} = {}) {
  return buildDailyTrainingContext({
    checkIn: dailyCheckIn,
    goal: bodyGoal,
    settings: settings(equipmentPreference),
    equipment: equipmentCatalog,
    exercises: exerciseCatalog,
    workoutLogs,
    bodyCompositions,
    mealLogs: meals,
    nutritionProfile: profile,
    now
  });
}

function hasLowerBodyExercise(planItems: ReturnType<typeof generateWorkoutPlanFromDecision>["items"]) {
  return planItems.some(
    (item) =>
      lowerMuscles.has(item.exercise.primary_muscle)
      || lowerMuscles.has(item.exercise.target_region)
      || item.exercise.secondary_muscles.some((muscle) => lowerMuscles.has(muscle))
  );
}

function scenario1() {
  const chestLogs = Array.from({ length: 12 }, (_, index) =>
    setLog(index, "ex-selectorized-chest-press", "eq-selectorized-chest-press", 2)
  );
  const dailyCheckIn = checkIn({
    avoidMusclesToday: ["lower_body"],
    scheduleConstraints: [
      {
        id: "walk",
        date,
        activityType: "long_walk",
        expectedDurationMinutes: 180,
        intensity: "normal",
        affectedMuscles: ["quads", "hamstrings", "glutes", "calves"],
        memo: "내일 오래 걷기"
      }
    ]
  });
  const context = buildContext({
    dailyCheckIn,
    workoutLogs: chestLogs,
    equipmentPreference: "machine_only"
  });
  const decision = generateFallbackTrainingDecision(context);
  const plan = generateWorkoutPlanFromDecision({
    decision,
    input: {
      workoutType: "full_body",
      availableMinutes: 60,
      intensity: decision.overallIntensity,
      equipmentPreference: "machine_only",
      soreMuscles: [],
      temporarilyUnavailableEquipmentIds: context.hardConstraints.unavailableEquipmentIds,
      avoidedEquipmentIds: context.hardConstraints.disabledEquipmentIds,
      recentExerciseIds: []
    },
    forbiddenMuscles: context.hardConstraints.forbiddenMuscles,
    forbiddenMovementFamilies: context.hardConstraints.forbiddenMovementFamilies
  });

  assert.equal(hasLowerBodyExercise(plan.items), false);
  assert.ok(plan.items.every((item) => item.equipment.every((equipment) => ["machine", "cardio"].includes(equipment.equipment_type))));
  assert.ok(decision.estimatedDurationMinutes <= 60);
  assert.equal(/Push Day|Pull Day|Legs/i.test(decision.sessionTitle), false);
  assert.ok(
    decision.selectedMuscles.some((item) => ["lats", "upper_back", "side_delt", "rear_delt"].includes(item.muscle))
  );
}

function scenario2() {
  const context = buildContext({
    dailyCheckIn: checkIn({
      sorenessMuscles: ["side_delt"],
      sorenessLevel: { side_delt: 8 }
    }),
    bodyGoal: goal({ priorityMuscles: ["side_delt"] }),
    workoutLogs: Array.from({ length: 6 }, (_, index) =>
      setLog(index, "ex-machine-lateral-raise", "eq-lateral-raise", 1, {
        rpe: 9,
        rir: 0,
        isFailure: true
      })
    )
  });
  const decision = generateFallbackTrainingDecision(context);
  assert.equal(decision.selectedMuscles.some((item) => item.muscle === "side_delt"), false);
  assert.equal(
    decision.movementSlots.some(
      (slot) => slot.primaryMuscle === "side_delt" || slot.targetRegion === "side_delt"
    ),
    false
  );
}

function scenario3() {
  const context = buildContext({
    dailyCheckIn: checkIn({ avoidMusclesToday: ["lower_body"] })
  });
  const invalidDecision = {
    sessionMode: "strength" as const,
    sessionTitle: "대퇴사두 집중",
    selectedMuscles: [{ muscle: "quads", priority: 1, targetEffectiveSets: 4, reason: "bad" }],
    excludedMuscles: [],
    movementSlots: [
      {
        slotId: "bad",
        primaryMuscle: "quads",
        targetRegion: "quads",
        movementFamily: "squat" as const,
        targetSets: 4,
        repMin: 8,
        repMax: 12,
        intensity: "normal" as const,
        priority: 1,
        reason: "bad"
      }
    ],
    overallIntensity: "normal" as const,
    volumeMultiplier: 1,
    estimatedDurationMinutes: 30,
    evidenceKeys: [],
    reasoningSummary: [],
    warnings: [],
    confidence: "high" as const,
    requiresUserConfirmation: false
  };
  const validated = validateDailyTrainingDecision(invalidDecision, context);
  assert.equal(validated.selectedMuscles.some((item) => item.muscle === "quads"), false);
  assert.equal(validated.movementSlots.some((slot) => slot.primaryMuscle === "quads"), false);
}

function scenario4() {
  const csv = [
    "날짜,측정장비,체중(kg),골격근량(kg),체지방량(kg),체지방률(%)",
    "20260619155555,InBody,80.2,34.1,0,14.2"
  ].join("\n");
  const parsed = parseInBodyCsv(csv);
  const trend = getInBodyTrendSummary(parsed.records);
  assert.equal(parsed.records[0].bodyFatMassKg, 0);
  assert.equal(trend.status, "insufficient_data");
  assert.equal(trend.summary.join(" ").includes("근손실"), false);
}

function scenario5() {
  const profile = nutritionProfile();
  const meals: MealLog[] = [
    {
      id: "breakfast",
      loggedAt: `${date}T08:00:00+09:00`,
      mealName: "아침",
      calories: 1200,
      proteinG: 20,
      carbsG: 180,
      fatG: 70,
      memo: ""
    },
    {
      id: "lunch",
      loggedAt: `${date}T12:00:00+09:00`,
      mealName: "점심",
      calories: 900,
      proteinG: 25,
      carbsG: 120,
      fatG: 40,
      memo: ""
    }
  ];
  const plan = calculateDailyNutritionPlan({
    profile,
    goal: goal(),
    checkIn: checkIn(),
    decision: generateFallbackTrainingDecision(buildContext({ meals, profile })),
    meals,
    supplements: []
  });
  const remainingTargets = Object.values(plan.mealTargets);
  assert.ok(remainingTargets.every((target) => target.carbsG >= 0 && target.fatG >= 0));
  assert.ok(remainingTargets.reduce((sum, target) => sum + target.proteinG, 0) > 0);
}

function scenario6() {
  const context = buildContext({
    dailyCheckIn: checkIn({ avoidMusclesToday: ["lower_body"] })
  });
  const decision = generateFallbackTrainingDecision(context);
  const plan = generateWorkoutPlanFromDecision({
    decision,
    forbiddenMuscles: context.hardConstraints.forbiddenMuscles,
    forbiddenMovementFamilies: context.hardConstraints.forbiddenMovementFamilies
  });
  assert.equal(hasLowerBodyExercise(plan.items), false);
}

function scenario7() {
  const context = buildContext();
  const decision = generateFallbackTrainingDecision(context);
  assert.equal(decision.fallbackUsed, true);
  assert.ok(Array.isArray(decision.movementSlots));
}

scenario1();
scenario2();
scenario3();
scenario4();
scenario5();
scenario6();
scenario7();

console.log("core scenarios passed");

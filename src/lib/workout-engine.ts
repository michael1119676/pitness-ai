import { equipmentCatalog } from "@/lib/equipment-data";
import { exerciseCatalog } from "@/lib/exercise-data";
import { titleCase } from "@/lib/format";
import type { DailyTrainingDecision, ExerciseModality, ExerciseRole, SessionVolumePrescription } from "@/lib/daily-types";
import {
  calculateSessionVolumePrescription,
  defaultPersonalTrainingStyleProfile,
  generateWarmupPrescription
} from "@/lib/training-style";
import {
  emptyWorkoutInput,
  muscles,
  targetRegions,
  type Equipment,
  type Exercise,
  type ExerciseScore,
  type GenerateWorkoutInput,
  type Intensity,
  type MovementFamily,
  type Muscle,
  type TargetRegion,
  type UserPreference,
  type WorkoutPlan,
  type WorkoutPlanItem,
  type WorkoutSlot,
  type WorkoutType
} from "@/lib/types";

const fatigueRank = {
  low: 1,
  medium: 2,
  medium_high: 3,
  high: 4
};

const preferenceRank: Record<UserPreference, number> = {
  preferred: 3,
  neutral: 2,
  avoid: 1,
  disabled: 0
};

function pretty(value: string) {
  return titleCase(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function patternSimilarity(a?: string, b?: string) {
  if (!a || !b) return 0;
  if (a === b) return 18;
  const aParts = new Set(a.split("_"));
  const bParts = b.split("_");
  const shared = bParts.filter((part) => aParts.has(part)).length;
  return shared >= 2 ? 10 : shared === 1 ? 5 : 0;
}

export const workoutSlots: Record<WorkoutType, WorkoutSlot[]> = {
  push: [
    {
      id: "push-upper-chest",
      label: "상부 가슴 프레스",
      primary_muscle: "chest",
      target_region: "upper_chest",
      movement_family: "horizontal_push",
      movement_pattern: "incline_press",
      priority: 1
    },
    {
      id: "push-lower-chest",
      label: "중/하부 가슴 프레스",
      primary_muscle: "chest",
      target_region: "lower_chest",
      movement_family: "horizontal_push",
      movement_pattern: "decline_press",
      priority: 2
    },
    {
      id: "push-chest-fly",
      label: "가슴 플라이",
      primary_muscle: "chest",
      target_region: "mid_chest",
      movement_family: "fly",
      movement_pattern: "pec_deck_fly",
      priority: 3
    },
    {
      id: "push-shoulder-press",
      label: "숄더 프레스",
      primary_muscle: "front_delt",
      target_region: "front_delt",
      movement_family: "vertical_push",
      movement_pattern: "machine_shoulder_press",
      priority: 4
    },
    {
      id: "push-lateral-raise",
      label: "레터럴 레이즈",
      primary_muscle: "side_delt",
      target_region: "side_delt",
      movement_family: "shoulder_abduction",
      movement_pattern: "machine_lateral_raise",
      priority: 5
    },
    {
      id: "push-triceps",
      label: "삼두 익스텐션",
      primary_muscle: "triceps",
      target_region: "triceps",
      movement_family: "elbow_extension",
      movement_pattern: "triceps_pushdown",
      priority: 6
    }
  ],
  pull: [
    {
      id: "pull-vertical",
      label: "수직 당기기",
      primary_muscle: "lats",
      target_region: "lats",
      movement_family: "vertical_pull",
      movement_pattern: "wide_pulldown",
      priority: 1
    },
    {
      id: "pull-horizontal",
      label: "수평 로우",
      primary_muscle: "mid_back",
      target_region: "mid_back",
      movement_family: "horizontal_pull",
      movement_pattern: "chest_supported_row",
      priority: 2
    },
    {
      id: "pull-upper-back",
      label: "상부 등 로우",
      primary_muscle: "upper_back",
      target_region: "upper_back",
      movement_family: "horizontal_pull",
      movement_pattern: "wide_cable_row",
      priority: 3
    },
    {
      id: "pull-lat-isolation",
      label: "광배 고립",
      primary_muscle: "lats",
      target_region: "lats",
      movement_family: "shoulder_extension",
      movement_pattern: "machine_pullover",
      priority: 4
    },
    {
      id: "pull-rear-delt",
      label: "후면 어깨",
      primary_muscle: "rear_delt",
      target_region: "rear_delt",
      movement_family: "fly",
      movement_pattern: "rear_delt_fly",
      priority: 5
    },
    {
      id: "pull-biceps",
      label: "이두 컬",
      primary_muscle: "biceps",
      target_region: "biceps",
      movement_family: "elbow_flexion",
      movement_pattern: "preacher_curl",
      priority: 6
    }
  ],
  legs: [
    {
      id: "legs-squat-press",
      label: "스쿼트/프레스 패턴",
      primary_muscle: "quads",
      target_region: "quads",
      movement_family: "squat",
      movement_pattern: "hack_squat",
      priority: 1
    },
    {
      id: "legs-quad-isolation",
      label: "대퇴사두 고립",
      primary_muscle: "quads",
      target_region: "quads",
      movement_family: "knee_extension",
      movement_pattern: "leg_extension",
      priority: 2
    },
    {
      id: "legs-hamstring-curl",
      label: "햄스트링 컬",
      primary_muscle: "hamstrings",
      target_region: "hamstrings",
      movement_family: "knee_flexion",
      movement_pattern: "seated_leg_curl",
      priority: 3
    },
    {
      id: "legs-glutes",
      label: "둔근 힌지",
      primary_muscle: "glutes",
      target_region: "glutes",
      movement_family: "hinge",
      movement_pattern: "glute_drive",
      priority: 4
    },
    {
      id: "legs-hip-abduction",
      label: "고관절 외전/내전",
      primary_muscle: "abductors",
      target_region: "abductors",
      movement_family: "hip_abduction",
      movement_pattern: "hip_abduction",
      priority: 5
    },
    {
      id: "legs-calf",
      label: "카프 레이즈",
      primary_muscle: "calves",
      target_region: "calves",
      movement_family: "squat",
      movement_pattern: "standing_calf_raise",
      priority: 6
    }
  ],
  upper: [
    {
      id: "upper-chest",
      label: "가슴 프레스",
      primary_muscle: "chest",
      target_region: "mid_chest",
      movement_family: "horizontal_push",
      movement_pattern: "flat_press",
      priority: 1
    },
    {
      id: "upper-row",
      label: "로우",
      primary_muscle: "mid_back",
      target_region: "mid_back",
      movement_family: "horizontal_pull",
      movement_pattern: "chest_supported_row",
      priority: 2
    },
    {
      id: "upper-pulldown",
      label: "수직 당기기",
      primary_muscle: "lats",
      target_region: "lats",
      movement_family: "vertical_pull",
      movement_pattern: "wide_pulldown",
      priority: 3
    },
    {
      id: "upper-shoulder",
      label: "숄더 프레스",
      primary_muscle: "front_delt",
      target_region: "front_delt",
      movement_family: "vertical_push",
      movement_pattern: "machine_shoulder_press",
      priority: 4
    },
    {
      id: "upper-lateral",
      label: "레터럴 레이즈",
      primary_muscle: "side_delt",
      target_region: "side_delt",
      movement_family: "shoulder_abduction",
      movement_pattern: "machine_lateral_raise",
      priority: 5
    },
    {
      id: "upper-arms",
      label: "팔 마무리",
      primary_muscle: "triceps",
      target_region: "triceps",
      movement_family: "elbow_extension",
      movement_pattern: "triceps_pushdown",
      priority: 6
    }
  ],
  lower: [
    {
      id: "lower-press",
      label: "레그 프레스/스쿼트",
      primary_muscle: "quads",
      target_region: "quads",
      movement_family: "squat",
      movement_pattern: "leg_press_45",
      priority: 1
    },
    {
      id: "lower-curl",
      label: "햄스트링 컬",
      primary_muscle: "hamstrings",
      target_region: "hamstrings",
      movement_family: "knee_flexion",
      movement_pattern: "seated_leg_curl",
      priority: 2
    },
    {
      id: "lower-extension",
      label: "대퇴사두 고립",
      primary_muscle: "quads",
      target_region: "quads",
      movement_family: "knee_extension",
      movement_pattern: "leg_extension",
      priority: 3
    },
    {
      id: "lower-glute",
      label: "둔근 패턴",
      primary_muscle: "glutes",
      target_region: "glutes",
      movement_family: "hinge",
      movement_pattern: "glute_drive",
      priority: 4
    },
    {
      id: "lower-adduction",
      label: "고관절 내전",
      primary_muscle: "adductors",
      target_region: "adductors",
      movement_family: "hip_adduction",
      movement_pattern: "hip_adduction",
      priority: 5
    },
    {
      id: "lower-calf",
      label: "카프 레이즈",
      primary_muscle: "calves",
      target_region: "calves",
      movement_family: "squat",
      movement_pattern: "seated_calf_raise",
      priority: 6
    }
  ],
  full_body: [
    {
      id: "full-legs",
      label: "레그 프레스/스쿼트",
      primary_muscle: "quads",
      target_region: "quads",
      movement_family: "squat",
      movement_pattern: "leg_press_45",
      priority: 1
    },
    {
      id: "full-chest",
      label: "가슴 프레스",
      primary_muscle: "chest",
      target_region: "mid_chest",
      movement_family: "horizontal_push",
      movement_pattern: "flat_press",
      priority: 2
    },
    {
      id: "full-row",
      label: "로우",
      primary_muscle: "mid_back",
      target_region: "mid_back",
      movement_family: "horizontal_pull",
      movement_pattern: "chest_supported_row",
      priority: 3
    },
    {
      id: "full-pulldown",
      label: "풀다운",
      primary_muscle: "lats",
      target_region: "lats",
      movement_family: "vertical_pull",
      movement_pattern: "wide_pulldown",
      priority: 4
    },
    {
      id: "full-shoulder",
      label: "어깨 보조",
      primary_muscle: "side_delt",
      target_region: "side_delt",
      movement_family: "shoulder_abduction",
      movement_pattern: "machine_lateral_raise",
      priority: 5
    },
    {
      id: "full-core",
      label: "코어",
      primary_muscle: "abs",
      target_region: "abs",
      movement_family: "core",
      movement_pattern: "machine_crunch",
      priority: 6
    }
  ],
  rest: []
};

export function getEquipmentForExercise(
  exercise: Exercise,
  equipment: Equipment[] = equipmentCatalog
) {
  if (exercise.equipment_requirement) {
    const allOf = exercise.equipment_requirement.allOf
      .map((id) => equipment.find((item) => item.id === id))
      .filter((item): item is Equipment => Boolean(item));
    const oneOf = exercise.equipment_requirement.oneOfGroups
      .map((group) => group.map((id) => equipment.find((item) => item.id === id)).find(Boolean))
      .filter((item): item is Equipment => Boolean(item));
    return [...allOf, ...oneOf];
  }

  return exercise.required_equipment_ids
    .map((id) => equipment.find((item) => item.id === id))
    .filter((item): item is Equipment => Boolean(item));
}

function exerciseEquipmentRequirementCount(exercise: Exercise) {
  if (exercise.equipment_requirement) {
    return exercise.equipment_requirement.allOf.length + exercise.equipment_requirement.oneOfGroups.length;
  }
  return exercise.required_equipment_ids.length;
}

function isEquipmentAllowedByMode(
  equipment: Equipment,
  input: Pick<GenerateWorkoutInput, "equipmentPreference">
) {
  if (input.equipmentPreference === "free_weight_allowed") return true;
  if (input.equipmentPreference === "machine_only") {
    return equipment.equipment_type === "machine" || equipment.equipment_type === "cardio";
  }
  return ["machine", "cable", "cardio", "accessory"].includes(equipment.equipment_type);
}

function isEquipmentAvailableForWorkout(equipment: Equipment, input: GenerateWorkoutInput) {
  if (!equipment.is_available) return false;
  if (equipment.user_preference === "disabled") return false;
  if (equipment.user_preference === "avoid") return false;
  if (input.temporarilyUnavailableEquipmentIds.includes(equipment.id)) return false;
  if (input.avoidedEquipmentIds.includes(equipment.id)) return false;
  return isEquipmentAllowedByMode(equipment, input);
}

export function filterAvailableExercises(
  exercises: Exercise[] = exerciseCatalog,
  equipment: Equipment[] = equipmentCatalog,
  input: GenerateWorkoutInput = emptyWorkoutInput
) {
  return exercises.filter((exercise) => {
    const requiredEquipment = getEquipmentForExercise(exercise, equipment);
    if (requiredEquipment.length !== exerciseEquipmentRequirementCount(exercise)) return false;
    return requiredEquipment.every((item) => isEquipmentAvailableForWorkout(item, input));
  });
}

function scoreEquipment(equipment: Equipment[], input: GenerateWorkoutInput) {
  const reasons: string[] = [];
  let score = 0;

  const bestPreference = equipment.reduce(
    (best, item) =>
      preferenceRank[item.user_preference] > preferenceRank[best]
        ? item.user_preference
        : best,
    "neutral" as UserPreference
  );

  if (bestPreference === "preferred") {
    score += 18;
    reasons.push("선호 기구");
  } else {
    score += 8;
    reasons.push("보통 선호도 기구");
  }

  if (equipment.some((item) => item.equipment_type === "machine")) {
    score += input.equipmentPreference === "machine_only" ? 14 : 10;
    reasons.push("머신 기반");
  }

  if (equipment.some((item) => item.equipment_type === "cable")) {
    score += input.equipmentPreference === "machine_cable_priority" ? 12 : 7;
    reasons.push("케이블 호환");
  }

  if (equipment.some((item) => item.equipment_type === "smith_machine")) {
    score += input.equipmentPreference === "free_weight_allowed" ? 4 : -40;
  }

  const setupPenalty = equipment.reduce((total, item) => {
    if (item.setup_difficulty === "high") return total + 6;
    if (item.setup_difficulty === "medium") return total + 3;
    return total;
  }, 0);

  return { score: score - setupPenalty, reasons };
}

export function scoreExerciseForSlot(
  exercise: Exercise,
  slot: WorkoutSlot,
  equipment: Equipment[] = equipmentCatalog,
  input: GenerateWorkoutInput = emptyWorkoutInput
): ExerciseScore {
  const requiredEquipment = getEquipmentForExercise(exercise, equipment);
  const reasons: string[] = [];
  let score = 0;

  if (requiredEquipment.length !== exerciseEquipmentRequirementCount(exercise)) {
    return { exercise, equipment: requiredEquipment, score: Number.NEGATIVE_INFINITY, reasons };
  }

  if (!requiredEquipment.every((item) => isEquipmentAvailableForWorkout(item, input))) {
    return { exercise, equipment: requiredEquipment, score: Number.NEGATIVE_INFINITY, reasons };
  }

  if (slot.primary_muscle) {
    if (exercise.primary_muscle === slot.primary_muscle) {
      score += 40;
      reasons.push(`주동근 일치: ${pretty(slot.primary_muscle)}`);
    } else if (exercise.secondary_muscles.includes(slot.primary_muscle)) {
      score += 16;
      reasons.push(`보조 근육 포함: ${pretty(slot.primary_muscle)}`);
    }
  }

  if (slot.target_region && exercise.target_region === slot.target_region) {
    score += 24;
    reasons.push(`타깃 부위 일치: ${pretty(slot.target_region)}`);
  }

  if (exercise.movement_family === slot.movement_family) {
    score += 26;
    reasons.push(`움직임 계열 일치: ${pretty(slot.movement_family)}`);
  }

  const patternScore = patternSimilarity(slot.movement_pattern, exercise.movement_pattern);
  if (patternScore > 0) {
    score += patternScore;
    reasons.push(
      patternScore >= 18
        ? `움직임 패턴 일치: ${pretty(exercise.movement_pattern)}`
        : "움직임 패턴이 유사"
    );
  }

  const equipmentScore = scoreEquipment(requiredEquipment, input);
  score += equipmentScore.score;
  reasons.push(...equipmentScore.reasons);

  if (input.soreMuscles.includes(exercise.primary_muscle)) {
    score -= 35;
    reasons.push(`${pretty(exercise.primary_muscle)} 통증/피로로 감점`);
  }

  if (exercise.secondary_muscles.some((muscle) => input.soreMuscles.includes(muscle))) {
    score -= 12;
    reasons.push("보조 근육 피로로 감점");
  }

  if (input.recentExerciseIds.includes(exercise.id)) {
    score -= 12;
    reasons.push("최근 사용 이력으로 소폭 감점");
  }

  if (input.intensity === "low" && fatigueRank[exercise.fatigue_score] >= 3) {
    score -= 16;
    reasons.push("낮은 강도에 비해 피로도가 높아 감점");
  }

  if (input.intensity === "high" && fatigueRank[exercise.fatigue_score] >= 3) {
    score += 4;
  }

  if (input.intensity === "low" && exercise.technical_difficulty === "high") {
    score -= 6;
  }

  return { exercise, equipment: requiredEquipment, score, reasons };
}

function setCountForIntensity(defaultSets: number, intensity: Intensity) {
  if (intensity === "low") return Math.max(2, defaultSets - 1);
  if (intensity === "high") return defaultSets + 1;
  return defaultSets;
}

function restForIntensity(defaultRest: number, intensity: Intensity) {
  if (intensity === "low") return Math.max(45, defaultRest - 15);
  if (intensity === "high") return defaultRest + 15;
  return defaultRest;
}

function weightForIntensity(defaultWeight: number | undefined, intensity: Intensity) {
  if (defaultWeight === undefined) return undefined;
  const multiplier = intensity === "low" ? 0.9 : intensity === "high" ? 1.05 : 1;
  return Math.round(defaultWeight * multiplier * 2) / 2;
}

function buildSelectionReason(item: ExerciseScore, slot: WorkoutSlot) {
  const equipment = item.equipment[0];
  const equipmentLabel = equipment
    ? `${pretty(equipment.user_preference)} ${pretty(equipment.equipment_type)}`
    : "등록된";
  const reasonBits = item.reasons.slice(0, 4).join(", ");

  return `${slot.label} 슬롯에 맞는 ${equipmentLabel} 옵션이라 선택했습니다. 근거: ${reasonBits}.`;
}

function estimateMaxItems(availableMinutes: number, totalSlots: number, intensity: Intensity) {
  const minutesPerItem = intensity === "high" ? 10 : intensity === "low" ? 8 : 9;
  return clamp(Math.floor(availableMinutes / minutesPerItem), 3, Math.max(totalSlots, 9));
}

function isMuscle(value: string): value is Muscle {
  return (muscles as readonly string[]).includes(value);
}

function isTargetRegion(value: string): value is TargetRegion {
  return (targetRegions as readonly string[]).includes(value);
}

export function exerciseTouchesForbidden(
  exercise: Exercise,
  forbiddenMuscles: string[] = [],
  forbiddenMovementFamilies: MovementFamily[] = []
) {
  const forbidden = new Set(forbiddenMuscles);
  return (
    forbidden.has(exercise.primary_muscle)
    || forbidden.has(exercise.target_region)
    || exercise.secondary_muscles.some((muscle) => forbidden.has(muscle))
    || forbiddenMovementFamilies.includes(exercise.movement_family)
  );
}

function slotFromDecisionSlot(
  slot: DailyTrainingDecision["movementSlots"][number],
  index: number
): WorkoutSlot {
  return {
    id: slot.slotId || `decision-slot-${index + 1}`,
    label: slot.targetRegion
      ? `${pretty(slot.targetRegion)} ${pretty(slot.movementFamily)}`
      : `${pretty(slot.primaryMuscle)} ${pretty(slot.movementFamily)}`,
    primary_muscle: isMuscle(slot.primaryMuscle) ? slot.primaryMuscle : undefined,
    target_region: slot.targetRegion && isTargetRegion(slot.targetRegion) ? slot.targetRegion : undefined,
    movement_family: slot.movementFamily,
    priority: slot.priority || index + 1
  };
}

function reasonFromDecision(item: ExerciseScore, slot: WorkoutSlot, decisionReason: string) {
  return `${buildSelectionReason(item, slot)} 오늘 결정 근거: ${decisionReason}`;
}

function exerciseModality(exercise: Exercise, equipment: Equipment[]): ExerciseModality {
  const firstType = exercise.equipment_type_preference[0] ?? equipment[0]?.equipment_type ?? "machine";
  if (["machine", "cable", "barbell", "dumbbell", "smith_machine", "bodyweight", "accessory"].includes(firstType)) {
    return firstType as ExerciseModality;
  }
  return "machine";
}

function exerciseRole(exercise: Exercise): ExerciseRole {
  if (exercise.exercise_role) return exercise.exercise_role;
  if (["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "squat", "hinge"].includes(exercise.movement_family)) {
    return "primary_compound";
  }
  return "primary_isolation";
}

function recommendedWeightKg(item: Pick<WorkoutPlanItem, "recommended_weight_lbs">) {
  return item.recommended_weight_lbs === undefined
    ? null
    : Math.round(item.recommended_weight_lbs * 0.453592 * 2) / 2;
}

function withWarmups(items: WorkoutPlanItem[]) {
  const warmedMuscles: string[] = [];
  return items.map((item, index) => {
    const warmupSets = generateWarmupPrescription({
      exercise: item.exercise,
      role: exerciseRole(item.exercise),
      modality: exerciseModality(item.exercise, item.equipment),
      recommendedWorkingWeightKg: recommendedWeightKg(item),
      previousExercise: index > 0 ? items[index - 1].exercise : null,
      musclesAlreadyWarmedUp: warmedMuscles
    });
    warmedMuscles.push(item.exercise.primary_muscle, item.exercise.target_region, ...item.exercise.secondary_muscles);
    return {
      ...item,
      warmupSets
    };
  });
}

function totalWorkingSets(items: WorkoutPlanItem[]) {
  return items.reduce((sum, item) => sum + item.sets, 0);
}

function totalWarmupSets(items: WorkoutPlanItem[]) {
  return items.reduce((sum, item) => sum + (item.warmupSets?.length ?? 0), 0);
}

function isFreeWeightItem(item: WorkoutPlanItem) {
  return item.equipment.some((equipment) => ["barbell", "dumbbell"].includes(equipment.equipment_type));
}

function candidateScoreForCompletion(item: ExerciseScore, focusMuscles: string[], existingItems: WorkoutPlanItem[]) {
  const exercise = item.exercise;
  const existingPatterns = existingItems.filter((existing) => existing.exercise.movement_pattern === exercise.movement_pattern).length;
  const focusScore =
    focusMuscles.includes(exercise.primary_muscle) || focusMuscles.includes(exercise.target_region)
      ? 35
      : exercise.secondary_muscles.some((muscle) => focusMuscles.includes(muscle))
        ? 18
        : ["rear_delt", "side_delt", "biceps", "triceps", "upper_back"].includes(exercise.primary_muscle)
          ? 12
          : 0;
  const roleScore =
    exerciseRole(exercise).includes("compound") ? 10 : existingItems.length >= 4 ? 14 : 4;
  return item.score + focusScore + roleScore - existingPatterns * 22;
}

export function validateAndCompleteSessionPlan(input: {
  draftPlan: WorkoutPlan;
  volumePrescription: SessionVolumePrescription;
  availableExercises: Exercise[];
  equipment?: Equipment[];
  hardConstraints: {
    forbiddenMuscles: string[];
    forbiddenMovementFamilies: MovementFamily[];
  };
}): WorkoutPlan {
  const equipment = input.equipment ?? equipmentCatalog;
  const selectedIds = new Set(input.draftPlan.items.map((item) => item.exercise.id));
  const focusMuscles = input.draftPlan.focusMuscles ?? [];
  const baseInput: GenerateWorkoutInput = {
    ...emptyWorkoutInput,
    workoutType: "full_body",
    availableMinutes: input.volumePrescription.targetDurationMinutes,
    intensity: input.draftPlan.intensity,
    equipmentPreference:
      defaultPersonalTrainingStyleProfile.equipmentMixMode === "machine_only"
        ? "machine_only"
        : "free_weight_allowed",
    soreMuscles: [],
    temporarilyUnavailableEquipmentIds: [],
    avoidedEquipmentIds: [],
    recentExerciseIds: []
  };
  let items = withWarmups(input.draftPlan.items);
  const completionSlots: WorkoutSlot[] = [
    ...workoutSlots.pull,
    ...workoutSlots.push,
    ...workoutSlots.legs,
    ...workoutSlots.upper,
    ...workoutSlots.full_body
  ];

  while (
    items.length < input.volumePrescription.minExerciseCount
    || totalWorkingSets(items) < input.volumePrescription.minWorkingSetCount
  ) {
    if (items.length >= input.volumePrescription.maxExerciseCount) break;
    const slot = completionSlots.find((candidateSlot) =>
      !items.some((item) => item.slot.id === candidateSlot.id)
    );
    if (!slot) break;
    const candidate = input.availableExercises
      .filter((exercise) => !selectedIds.has(exercise.id))
      .filter((exercise) =>
        !exerciseTouchesForbidden(
          exercise,
          input.hardConstraints.forbiddenMuscles,
          input.hardConstraints.forbiddenMovementFamilies
        )
      )
      .map((exercise) => scoreExerciseForSlot(exercise, slot, equipment, baseInput))
      .filter((result) => Number.isFinite(result.score))
      .sort((a, b) => candidateScoreForCompletion(b, focusMuscles, items) - candidateScoreForCompletion(a, focusMuscles, items))[0];
    if (!candidate || candidate.score < 35) break;

    selectedIds.add(candidate.exercise.id);
    const sets = clamp(
      Math.round(input.volumePrescription.targetWorkingSetCount / Math.max(1, input.volumePrescription.targetExerciseCount)),
      2,
      5
    );
    const nextItem: WorkoutPlanItem = {
      id: `${slot.id}-${candidate.exercise.id}`,
      slot,
      exercise: candidate.exercise,
      equipment: candidate.equipment,
      score: candidate.score,
      sets,
      rep_min: candidate.exercise.default_rep_min,
      rep_max: candidate.exercise.default_rep_max,
      rest_seconds: restForIntensity(candidate.exercise.default_rest_seconds, input.draftPlan.intensity),
      recommended_weight_lbs: weightForIntensity(candidate.exercise.default_weight_lbs, input.draftPlan.intensity),
      reason: `${buildSelectionReason(candidate, slot)} 운동량 기준에 맞춰 보완했습니다.`
    };
    items = withWarmups([...items, nextItem]);
  }

  let setIndex = 0;
  while (totalWorkingSets(items) < input.volumePrescription.minWorkingSetCount && items.length > 0) {
    const item = items[setIndex % items.length];
    item.sets = clamp(item.sets + 1, 2, 5);
    setIndex += 1;
  }

  const hasFreeWeightCandidate = input.availableExercises.some((exercise) =>
    exercise.equipment_type_preference.some((type) => ["barbell", "dumbbell"].includes(type))
  );
  if (
    hasFreeWeightCandidate
    && !items.some(isFreeWeightItem)
    && input.volumePrescription.targetDurationMinutes >= 45
  ) {
    const replacementSlot = completionSlots.find((slot) =>
      ["horizontal_push", "horizontal_pull", "vertical_push", "elbow_flexion", "elbow_extension"].includes(slot.movement_family)
    );
    const freeCandidate = replacementSlot
      ? input.availableExercises
          .filter((exercise) => !selectedIds.has(exercise.id))
          .filter((exercise) => exercise.equipment_type_preference.some((type) => ["barbell", "dumbbell"].includes(type)))
          .filter((exercise) =>
            !exerciseTouchesForbidden(
              exercise,
              input.hardConstraints.forbiddenMuscles,
              input.hardConstraints.forbiddenMovementFamilies
            )
          )
          .map((exercise) => scoreExerciseForSlot(exercise, replacementSlot, equipment, baseInput))
          .filter((result) => Number.isFinite(result.score))
          .sort((a, b) => b.score - a.score)[0]
      : null;
    if (freeCandidate && freeCandidate.score >= 35 && items.length > 0) {
      const replaceIndex = Math.max(0, items.length - 1);
      items[replaceIndex] = {
        ...items[replaceIndex],
        id: `${replacementSlot!.id}-${freeCandidate.exercise.id}`,
        slot: replacementSlot!,
        exercise: freeCandidate.exercise,
        equipment: freeCandidate.equipment,
        score: freeCandidate.score,
        rep_min: freeCandidate.exercise.default_rep_min,
        rep_max: freeCandidate.exercise.default_rep_max,
        rest_seconds: restForIntensity(freeCandidate.exercise.default_rest_seconds, input.draftPlan.intensity),
        recommended_weight_lbs: weightForIntensity(freeCandidate.exercise.default_weight_lbs, input.draftPlan.intensity),
        reason: `${buildSelectionReason(freeCandidate, replacementSlot!)} 자동 균형 기준으로 프리웨이트를 1개 포함했습니다.`
      };
      items = withWarmups(items);
    }
  }

  const notes = [
    ...input.draftPlan.notes,
    `운동량 검증: 운동 ${items.length}개, 본세트 ${totalWorkingSets(items)}세트, 워밍업 ${totalWarmupSets(items)}세트.`
  ];

  return {
    ...input.draftPlan,
    items,
    volumePrescription: {
      ...input.volumePrescription,
      plannedWarmupSetCount: totalWarmupSets(items),
      targetTotalRecordedSetCount: totalWorkingSets(items) + totalWarmupSets(items)
    },
    notes
  };
}

export function generateWorkoutPlan({
  input = emptyWorkoutInput,
  exercises = exerciseCatalog,
  equipment = equipmentCatalog
}: {
  input?: GenerateWorkoutInput;
  exercises?: Exercise[];
  equipment?: Equipment[];
} = {}): WorkoutPlan {
  if (input.workoutType === "rest") {
    return {
      workoutType: "rest",
      generatedAt: new Date().toISOString(),
      availableMinutes: input.availableMinutes,
      intensity: input.intensity,
      items: [],
      skippedSlots: [],
      notes: ["휴식일이 선택되어 기구 기반 운동 루틴을 생성하지 않았습니다."]
    };
  }

  const slots = workoutSlots[input.workoutType].sort((a, b) => a.priority - b.priority);
  const selectedIds = new Set<string>();
  const items: WorkoutPlanItem[] = [];
  const skippedSlots: WorkoutSlot[] = [];
  const maxItems = estimateMaxItems(input.availableMinutes, slots.length, input.intensity);

  for (const slot of slots.slice(0, maxItems)) {
    const candidate = exercises
      .filter((exercise) => !selectedIds.has(exercise.id))
      .map((exercise) => scoreExerciseForSlot(exercise, slot, equipment, input))
      .filter((result) => Number.isFinite(result.score))
      .sort((a, b) => b.score - a.score)[0];

    if (!candidate || candidate.score < 45) {
      skippedSlots.push(slot);
      continue;
    }

    selectedIds.add(candidate.exercise.id);
    items.push({
      id: `${slot.id}-${candidate.exercise.id}`,
      slot,
      exercise: candidate.exercise,
      equipment: candidate.equipment,
      score: candidate.score,
      sets: setCountForIntensity(candidate.exercise.default_sets, input.intensity),
      rep_min: candidate.exercise.default_rep_min,
      rep_max: candidate.exercise.default_rep_max,
      rest_seconds: restForIntensity(candidate.exercise.default_rest_seconds, input.intensity),
      recommended_weight_lbs: weightForIntensity(
        candidate.exercise.default_weight_lbs,
        input.intensity
      ),
      reason: buildSelectionReason(candidate, slot)
    });
  }

  const availableExercises = filterAvailableExercises(exercises, equipment, input);
  const notes = [
    `${availableExercises.length}개 운동이 기구 사용 가능 여부와 선호도 필터를 통과했습니다.`,
    input.equipmentPreference === "machine_only"
      ? "머신만 모드입니다. 케이블, 스미스, 바벨, 덤벨, 맨몸 전용 운동은 제외했습니다."
      : input.equipmentPreference === "machine_cable_priority"
        ? "머신/케이블 우선 모드입니다. 프리웨이트와 맨몸 전용 운동은 제외했습니다."
        : "프리웨이트 허용 모드입니다. 그래도 등록된 선호 머신은 더 높은 점수를 받습니다."
  ];

  return {
    workoutType: input.workoutType,
    generatedAt: new Date().toISOString(),
    availableMinutes: input.availableMinutes,
    intensity: input.intensity,
    items,
    skippedSlots,
    notes
  };
}

export function generateWorkoutPlanFromDecision({
  decision,
  input = emptyWorkoutInput,
  exercises = exerciseCatalog,
  equipment = equipmentCatalog,
  forbiddenMuscles = [],
  forbiddenMovementFamilies = [],
  excludedExerciseIds = []
}: {
  decision: DailyTrainingDecision;
  input?: GenerateWorkoutInput;
  exercises?: Exercise[];
  equipment?: Equipment[];
  forbiddenMuscles?: string[];
  forbiddenMovementFamilies?: MovementFamily[];
  excludedExerciseIds?: string[];
}): WorkoutPlan {
  if (decision.sessionMode === "rest_recommended" || decision.movementSlots.length === 0) {
    return {
      workoutType: "rest",
      sessionTitle: decision.sessionTitle,
      focusMuscles: decision.selectedMuscles.map((item) => item.muscle),
      decisionSummary: decision.reasoningSummary,
      generatedAt: new Date().toISOString(),
      availableMinutes: input.availableMinutes,
      intensity: decision.overallIntensity,
      items: [],
      skippedSlots: [],
      notes: [
        "오늘 결정은 휴식 또는 회복 우선입니다.",
        ...decision.reasoningSummary,
        ...decision.warnings
      ]
    };
  }

  const selectedIds = new Set(excludedExerciseIds);
  const items: WorkoutPlanItem[] = [];
  const skippedSlots: WorkoutSlot[] = [];
  const planInput: GenerateWorkoutInput = {
    ...input,
    intensity: decision.overallIntensity,
    availableMinutes: decision.estimatedDurationMinutes || input.availableMinutes,
    equipmentPreference:
      input.equipmentPreference === "machine_only" ? "machine_only" : "free_weight_allowed"
  };
  const decisionSlots = decision.movementSlots
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .slice(0, estimateMaxItems(input.availableMinutes, decision.movementSlots.length, decision.overallIntensity));

  for (const [index, decisionSlot] of decisionSlots.entries()) {
    const slot = slotFromDecisionSlot(decisionSlot, index);
    const candidate = exercises
      .filter((exercise) => !selectedIds.has(exercise.id))
      .filter((exercise) => !exerciseTouchesForbidden(exercise, forbiddenMuscles, forbiddenMovementFamilies))
      .map((exercise) => scoreExerciseForSlot(exercise, slot, equipment, planInput))
      .filter((result) => Number.isFinite(result.score))
      .sort((a, b) => b.score - a.score)[0];

    if (!candidate || candidate.score < 38) {
      skippedSlots.push(slot);
      continue;
    }

    selectedIds.add(candidate.exercise.id);
    items.push({
      id: `${slot.id}-${candidate.exercise.id}`,
      slot,
      exercise: candidate.exercise,
      equipment: candidate.equipment,
      score: candidate.score,
      sets: clamp(Math.round(decisionSlot.targetSets * decision.volumeMultiplier), 1, 5),
      rep_min: decisionSlot.repMin || candidate.exercise.default_rep_min,
      rep_max: decisionSlot.repMax || candidate.exercise.default_rep_max,
      rest_seconds: restForIntensity(candidate.exercise.default_rest_seconds, decisionSlot.intensity),
      recommended_weight_lbs: weightForIntensity(
        candidate.exercise.default_weight_lbs,
        decisionSlot.intensity
      ),
      reason: reasonFromDecision(candidate, slot, decisionSlot.reason)
    });
  }

  const availableExercises = filterAvailableExercises(exercises, equipment, planInput).filter(
    (exercise) => !exerciseTouchesForbidden(exercise, forbiddenMuscles, forbiddenMovementFamilies)
  );

  const draftPlan: WorkoutPlan = {
    workoutType: "full_body",
    sessionTitle: decision.sessionTitle,
    focusMuscles: decision.selectedMuscles.map((item) => item.muscle),
    decisionSummary: decision.reasoningSummary,
    generatedAt: new Date().toISOString(),
    availableMinutes: input.availableMinutes,
    intensity: decision.overallIntensity,
    items,
    skippedSlots,
    notes: [
      `${availableExercises.length}개 운동이 오늘의 기구/금지 부위 필터를 통과했습니다.`,
      ...decision.reasoningSummary,
      ...decision.warnings
    ]
  };

  const volumePrescription =
    decision.volumePrescription
    ?? calculateSessionVolumePrescription({
      availableTimeMinutes: input.availableMinutes,
      readinessScore: decision.overallIntensity === "high" ? 9 : decision.overallIntensity === "low" ? 5 : 7,
      recoveryStatus: decision.overallIntensity === "low" ? "limited" : "normal",
      trainingStyleProfile: defaultPersonalTrainingStyleProfile,
      selectedMuscles: decision.selectedMuscles.map((item) => item.muscle),
      avoidMuscles: forbiddenMuscles,
      painMuscles: []
    });

  return validateAndCompleteSessionPlan({
    draftPlan,
    volumePrescription,
    availableExercises,
    equipment,
    hardConstraints: {
      forbiddenMuscles,
      forbiddenMovementFamilies
    }
  });
}

function replacementScore(
  candidate: ExerciseScore,
  currentItem: WorkoutPlanItem,
  input: GenerateWorkoutInput
) {
  let score = 0;
  const currentExercise = currentItem.exercise;
  const currentEquipmentType = currentItem.equipment[0]?.equipment_type;
  const candidateEquipmentType = candidate.equipment[0]?.equipment_type;

  if (candidate.exercise.primary_muscle === currentExercise.primary_muscle) score += 42;
  if (candidate.exercise.target_region === currentExercise.target_region) score += 30;
  if (candidate.exercise.movement_family === currentExercise.movement_family) score += 26;
  score += patternSimilarity(currentExercise.movement_pattern, candidate.exercise.movement_pattern);

  if (currentEquipmentType && candidateEquipmentType === currentEquipmentType) score += 14;
  if (
    candidate.equipment.some((item) =>
      currentItem.equipment.some((current) => current.category === item.category)
    )
  ) {
    score += 10;
  }

  if (candidate.equipment.some((item) => item.user_preference === "preferred")) score += 12;
  if (input.recentExerciseIds.includes(candidate.exercise.id)) score -= 12;

  return score + candidate.score * 0.3;
}

export function findReplacementExercise({
  currentItem,
  input = emptyWorkoutInput,
  exercises = exerciseCatalog,
  equipment = equipmentCatalog,
  excludedExerciseIds = [],
  avoidCurrentEquipment = true,
  forbiddenMuscles = [],
  forbiddenMovementFamilies = []
}: {
  currentItem: WorkoutPlanItem;
  input?: GenerateWorkoutInput;
  exercises?: Exercise[];
  equipment?: Equipment[];
  excludedExerciseIds?: string[];
  avoidCurrentEquipment?: boolean;
  forbiddenMuscles?: string[];
  forbiddenMovementFamilies?: MovementFamily[];
}): WorkoutPlanItem | null {
  const replacementInput: GenerateWorkoutInput = {
    ...input,
    avoidedEquipmentIds: avoidCurrentEquipment
      ? [...input.avoidedEquipmentIds, ...currentItem.equipment.map((item) => item.id)]
      : input.avoidedEquipmentIds
  };

  const slot: WorkoutSlot = {
    ...currentItem.slot,
    primary_muscle: currentItem.exercise.primary_muscle,
    target_region: currentItem.exercise.target_region,
    movement_family: currentItem.exercise.movement_family,
    movement_pattern: currentItem.exercise.movement_pattern
  };

  const candidate = exercises
    .filter(
      (exercise) =>
        exercise.id !== currentItem.exercise.id && !excludedExerciseIds.includes(exercise.id)
    )
    .filter((exercise) => !exerciseTouchesForbidden(exercise, forbiddenMuscles, forbiddenMovementFamilies))
    .map((exercise) => scoreExerciseForSlot(exercise, slot, equipment, replacementInput))
    .filter((result) => {
      if (!Number.isFinite(result.score)) return false;
      return result.equipment.every((item) =>
        ["preferred", "neutral"].includes(item.user_preference)
      );
    })
    .sort(
      (a, b) =>
        replacementScore(b, currentItem, replacementInput) -
        replacementScore(a, currentItem, replacementInput)
    )[0];

  if (!candidate) return null;

  return {
    ...currentItem,
    id: `${currentItem.slot.id}-${candidate.exercise.id}`,
    exercise: candidate.exercise,
    equipment: candidate.equipment,
    score: candidate.score,
    sets: setCountForIntensity(candidate.exercise.default_sets, input.intensity),
    rep_min: candidate.exercise.default_rep_min,
    rep_max: candidate.exercise.default_rep_max,
    rest_seconds: restForIntensity(candidate.exercise.default_rest_seconds, input.intensity),
    recommended_weight_lbs: weightForIntensity(
      candidate.exercise.default_weight_lbs,
      input.intensity
    ),
    reason: `${candidate.exercise.name}로 교체했습니다. ${pretty(
      currentItem.exercise.primary_muscle
    )}, ${pretty(currentItem.exercise.target_region)}, ${pretty(
      currentItem.exercise.movement_family
    )} 조건을 가장 잘 맞추면서 사용 가능한 선호/보통 기구를 사용합니다.`
  };
}

export function adjustRecommendedWeight(
  item: WorkoutPlanItem,
  direction: "down" | "up",
  percent = 0.075
): WorkoutPlanItem {
  if (item.recommended_weight_lbs === undefined) {
    return {
      ...item,
      reason: `${item.reason} 추천 중량이 없어 운동은 그대로 유지했습니다.`
    };
  }

  const multiplier = direction === "down" ? 1 - percent : 1 + percent;
  const adjusted = Math.max(0, Math.round(item.recommended_weight_lbs * multiplier * 2) / 2);

  return {
    ...item,
    recommended_weight_lbs: adjusted,
    reason: `${item.reason} 피드백을 반영해 추천 중량을 약 ${Math.round(percent * 100)}% ${
      direction === "down" ? "낮췄습니다" : "높였습니다"
    }.`
  };
}

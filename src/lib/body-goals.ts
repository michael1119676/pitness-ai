import type {
  BodyComposition,
  BodyGoalProgress,
  BodyMetricGoal
} from "@/lib/daily-types";

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function latestBodyComposition(records: BodyComposition[]) {
  return records
    .slice()
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0] ?? null;
}

function metricValue(goal: BodyMetricGoal, latest: BodyComposition | null) {
  if (!latest) return null;

  switch (goal.type) {
    case "body_weight_kg":
      return latest.weightKg;
    case "body_fat_percentage":
      return latest.bodyFatPercentage;
    case "skeletal_muscle_mass_kg":
      return latest.skeletalMuscleMassKg;
    case "skeletal_muscle_to_weight_ratio":
      if (!latest.weightKg || !latest.skeletalMuscleMassKg) return null;
      return latest.skeletalMuscleMassKg / latest.weightKg;
    case "waist_cm":
      return latest.waistCircumferenceCm;
    case "custom":
      return null;
  }
}

function targetForGoal(goal: BodyMetricGoal) {
  if (goal.direction === "target_range") {
    if (goal.targetMin !== null && goal.targetMax !== null) {
      return (goal.targetMin + goal.targetMax) / 2;
    }
    return goal.targetMin ?? goal.targetMax;
  }
  return goal.targetValue;
}

function isAchieved(goal: BodyMetricGoal, current: number, target: number) {
  if (goal.direction === "at_least") return current >= target;
  if (goal.direction === "at_most") return current <= target;
  if (goal.targetMin !== null && goal.targetMax !== null) {
    return current >= goal.targetMin && current <= goal.targetMax;
  }
  return Math.abs(current - target) < 0.0001;
}

function remaining(goal: BodyMetricGoal, current: number, target: number) {
  if (goal.direction === "at_least") return Math.max(0, target - current);
  if (goal.direction === "at_most") return Math.max(0, current - target);
  if (goal.targetMin !== null && current < goal.targetMin) return goal.targetMin - current;
  if (goal.targetMax !== null && current > goal.targetMax) return current - goal.targetMax;
  return 0;
}

function progressPercentage(goal: BodyMetricGoal, current: number, target: number) {
  if (target <= 0) return null;
  if (goal.direction === "at_most") {
    return current <= target ? 100 : round((target / current) * 100, 1);
  }
  return round(Math.min(100, (current / target) * 100), 1);
}

function skeletalMuscleRatioScenarios(goal: BodyMetricGoal, latest: BodyComposition | null) {
  if (
    goal.type !== "skeletal_muscle_to_weight_ratio"
    || goal.targetValue === null
    || !latest?.weightKg
    || !latest.skeletalMuscleMassKg
  ) {
    return [];
  }

  const targetMuscleKg = latest.weightKg * goal.targetValue;
  const muscleGainNeededKg = Math.max(0, targetMuscleKg - latest.skeletalMuscleMassKg);
  const targetWeightAtCurrentMuscle = latest.skeletalMuscleMassKg / goal.targetValue;

  return [
    {
      label: "골격근량 증가",
      description: `현재 체중을 유지한다면 골격근량 목표는 ${round(targetMuscleKg, 2)}kg이고, 약 ${round(muscleGainNeededKg, 2)}kg 증가가 필요합니다.`
    },
    {
      label: "체지방과 체중 감소",
      description: `현재 골격근량만 유지한다면 목표 체중은 약 ${round(targetWeightAtCurrentMuscle, 1)}kg입니다. 단순 감량만 권장하지 않고 근육 유지가 전제입니다.`
    },
    {
      label: "근육 증가 + 체지방 감소",
      description: "개인 체형 목표에 가장 자연스러운 경로입니다. 운동 볼륨과 단백질 목표를 함께 맞춰 진행합니다."
    }
  ];
}

export function calculateBodyGoalProgress(
  goal: BodyMetricGoal,
  bodyCompositions: BodyComposition[]
): BodyGoalProgress {
  const latest = latestBodyComposition(bodyCompositions);
  const currentValue = metricValue(goal, latest);
  const targetValue = targetForGoal(goal);
  const warnings = [
    "이 수치는 의학적 정상 기준이 아니라 사용자가 정한 개인 체형 목표입니다."
  ];

  if (currentValue === null || targetValue === null) {
    return {
      goalId: goal.id,
      currentValue,
      targetValue,
      progressPercentage: null,
      remainingValue: null,
      status: "insufficient_data",
      latestMeasuredAt: latest?.measuredAt ?? null,
      confidence: "low",
      scenarios: skeletalMuscleRatioScenarios(goal, latest),
      warnings: bodyCompositions.length <= 1
        ? [...warnings, "기록이 적어 장기 추세는 판단하지 않습니다."]
        : warnings
    };
  }

  const achieved = isAchieved(goal, currentValue, targetValue);
  return {
    goalId: goal.id,
    currentValue,
    targetValue,
    progressPercentage: progressPercentage(goal, currentValue, targetValue),
    remainingValue: remaining(goal, currentValue, targetValue),
    status: achieved ? "achieved" : "in_progress",
    latestMeasuredAt: latest?.measuredAt ?? null,
    confidence: bodyCompositions.length >= 3 ? "high" : bodyCompositions.length >= 2 ? "medium" : "low",
    scenarios: skeletalMuscleRatioScenarios(goal, latest),
    warnings: bodyCompositions.length <= 1
      ? [...warnings, "기록이 1개라 변화 추세는 낮은 신뢰도로 봅니다."]
      : warnings
  };
}

export function formatMetricGoal(goal: BodyMetricGoal) {
  if (goal.type === "skeletal_muscle_to_weight_ratio") {
    return `골격근량 비율 ${round((goal.targetValue ?? 0) * 100, 1)}% 이상`;
  }
  if (goal.type === "body_weight_kg") return `목표 체중 ${goal.targetValue ?? "-"}kg`;
  if (goal.type === "body_fat_percentage") return `체지방률 ${goal.targetValue ?? "-"}%`;
  if (goal.type === "skeletal_muscle_mass_kg") return `골격근량 ${goal.targetValue ?? "-"}kg`;
  if (goal.type === "waist_cm") return `허리둘레 ${goal.targetValue ?? "-"}cm`;
  return "직접 설정 목표";
}


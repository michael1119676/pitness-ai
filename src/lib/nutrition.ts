import type {
  BodyGoalProfile,
  DailyCheckIn,
  DailyNutritionPlan,
  DailyTrainingDecision,
  MealLog,
  NutritionProfile,
  NutritionStatus,
  UserSupplementProfile
} from "@/lib/daily-types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.max(0, Math.round(value));
}

function enabledMeals(profile: NutritionProfile) {
  return [
    profile.breakfastEnabled ? "아침" : null,
    profile.lunchEnabled ? "점심" : null,
    profile.dinnerEnabled ? "저녁" : null,
    profile.snackEnabled ? "간식" : null
  ].filter((meal): meal is string => Boolean(meal));
}

export function getNutritionStatus(meals: MealLog[], profile: NutritionProfile): NutritionStatus {
  const consumed = meals.reduce(
    (total, meal) => ({
      calories: total.calories + meal.calories,
      proteinG: total.proteinG + meal.proteinG,
      carbsG: total.carbsG + meal.carbsG,
      fatG: total.fatG + meal.fatG
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const loggedNames = new Set(meals.map((meal) => meal.mealName));
  const remainingMeals = enabledMeals(profile).filter((meal) => !loggedNames.has(meal));

  return {
    consumedCalories: round(consumed.calories),
    consumedProteinG: round(consumed.proteinG),
    consumedCarbsG: round(consumed.carbsG),
    consumedFatG: round(consumed.fatG),
    remainingMeals,
    notes: []
  };
}

export function calculateDailyNutritionPlan({
  profile,
  goal,
  checkIn,
  decision,
  meals,
  supplements
}: {
  profile: NutritionProfile;
  goal: BodyGoalProfile;
  checkIn: DailyCheckIn;
  decision: DailyTrainingDecision | null;
  meals: MealLog[];
  supplements: UserSupplementProfile[];
}): DailyNutritionPlan {
  const status = getNutritionStatus(meals, profile);
  const trainDay = checkIn.trainingIntent === "train" && decision?.sessionMode !== "rest_recommended";
  const intensityBoost = decision?.overallIntensity === "high" ? 120 : decision?.overallIntensity === "low" ? -80 : 0;
  const workoutCarbBoost = trainDay ? clamp((checkIn.availableTimeMinutes / 60) * 45, 20, 75) : -35;
  const goalCalorieBias =
    goal.mainBodyGoal === "fat_loss"
      ? -250
      : goal.mainBodyGoal === "bulk_muscle_gain"
        ? 220
        : goal.mainBodyGoal === "body_recomposition"
          ? -80
          : 0;

  const totalCalories = round(profile.startingTargetCalories + goalCalorieBias + intensityBoost);
  const proteinG = round(profile.targetProteinG);
  const carbsG = round(profile.targetCarbsG + workoutCarbBoost);
  const fatG = round(profile.targetFatG);

  const remainingMeals = status.remainingMeals.length > 0 ? status.remainingMeals : enabledMeals(profile);
  const remainingTargets = {
    calories: Math.max(0, totalCalories - status.consumedCalories),
    proteinG: Math.max(0, proteinG - status.consumedProteinG),
    carbsG: Math.max(0, carbsG - status.consumedCarbsG),
    fatG: Math.max(0, fatG - status.consumedFatG)
  };

  const mealTargets = remainingMeals.reduce<DailyNutritionPlan["mealTargets"]>((targets, meal) => {
    targets[meal] = {
      calories: round(remainingTargets.calories / remainingMeals.length),
      proteinG: round(remainingTargets.proteinG / remainingMeals.length),
      carbsG: round(remainingTargets.carbsG / remainingMeals.length),
      fatG: round(remainingTargets.fatG / remainingMeals.length)
    };
    return targets;
  }, {});

  const supplementChecklist = supplements
    .filter((supplement) => supplement.enabled)
    .map((supplement) =>
      [supplement.supplementName, supplement.userConfiguredDose, supplement.preferredTiming]
        .filter(Boolean)
        .join(" / ")
    );

  const notes = [
    trainDay
      ? "운동 예정이므로 남은 탄수화물을 운동 전후에 조금 더 배분했습니다."
      : "휴식일 기준으로 남은 탄수화물 목표를 낮춰 재분배했습니다.",
    status.consumedFatG > fatG ? "이미 지방 목표를 초과해 남은 끼니 지방 목표는 0 아래로 내리지 않았습니다." : "",
    status.consumedProteinG < proteinG * 0.45 && meals.length >= 2
      ? "단백질 섭취가 부족해 남은 끼니의 단백질 목표를 높였습니다."
      : ""
  ].filter(Boolean);

  return {
    totalCalories,
    proteinG,
    carbsG,
    fatG,
    mealTargets,
    preWorkoutCarbsG: trainDay ? round(carbsG * 0.2) : 0,
    postWorkoutCarbsG: trainDay ? round(carbsG * 0.25) : 0,
    supplementChecklist,
    notes
  };
}

"use client";

import { Plus, Save, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  DailyNutritionPlan,
  MealLog,
  NutritionProfile,
  UserSupplementProfile
} from "@/lib/daily-types";
import {
  buildDailyPlanSnapshot,
  loadDailyPlanningState,
  type DailyPlanningState
} from "@/lib/daily-plan-client";
import {
  appendDailyPlanRevision,
  defaultNutritionProfile,
  loadLatestDailyPlanRevision,
  saveMealLog,
  saveNutritionProfile,
  saveSupplements
} from "@/lib/local-store";

type MealDraft = {
  mealName: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  memo: string;
};

const emptyMealDraft: MealDraft = {
  mealName: "아침",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  memo: ""
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function NutritionPlanner() {
  const [state, setState] = useState<DailyPlanningState | null>(null);
  const [plan, setPlan] = useState<DailyNutritionPlan | null>(null);
  const [profile, setProfile] = useState<NutritionProfile>(defaultNutritionProfile);
  const [supplements, setSupplements] = useState<UserSupplementProfile[]>([]);
  const [mealDraft, setMealDraft] = useState<MealDraft>(emptyMealDraft);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loaded = loadDailyPlanningState();
    const latestRevision = loadLatestDailyPlanRevision(loaded.date);
    const snapshot = buildDailyPlanSnapshot(
      loaded,
      latestRevision?.trainingDecisionSnapshot ?? null
    );
    setState(loaded);
    setProfile(loaded.nutritionProfile);
    setSupplements(loaded.supplements);
    setPlan(snapshot.nutritionPlan);
  }, []);

  function refresh(nextState: DailyPlanningState) {
    const latestRevision = loadLatestDailyPlanRevision(nextState.date);
    const snapshot = buildDailyPlanSnapshot(
      nextState,
      latestRevision?.trainingDecisionSnapshot ?? null
    );
    setState(nextState);
    setPlan(snapshot.nutritionPlan);
    return snapshot;
  }

  function commitRevision(nextState: DailyPlanningState, triggerType: string, triggerPayload: unknown) {
    const snapshot = refresh(nextState);
    appendDailyPlanRevision({
      id: makeId("revision"),
      date: nextState.date,
      triggerType,
      triggerPayload,
      trainingDecisionSnapshot: snapshot.decision,
      finalWorkoutPlanSnapshot: snapshot.plan,
      nutritionPlanSnapshot: snapshot.nutritionPlan,
      createdAt: new Date().toISOString()
    });
  }

  function saveProfile() {
    if (!state) return;
    saveNutritionProfile(profile);
    const nextState = { ...state, nutritionProfile: profile };
    commitRevision(nextState, "nutrition_profile_saved", { profile });
    setMessage("식단 목표 설정을 저장했습니다.");
  }

  function saveSupplementList(nextSupplements: UserSupplementProfile[]) {
    if (!state) return;
    setSupplements(nextSupplements);
    saveSupplements(nextSupplements);
    const nextState = { ...state, supplements: nextSupplements };
    commitRevision(nextState, "supplement_profile_saved", {
      enabled: nextSupplements.filter((supplement) => supplement.enabled).map((supplement) => supplement.id)
    });
    setMessage("보조제 체크리스트 설정을 저장했습니다.");
  }

  function addMeal() {
    if (!state) return;
    const meal: MealLog = {
      id: makeId("meal"),
      loggedAt: new Date().toISOString(),
      mealName: mealDraft.mealName,
      calories: numberOrZero(mealDraft.calories),
      proteinG: numberOrZero(mealDraft.proteinG),
      carbsG: numberOrZero(mealDraft.carbsG),
      fatG: numberOrZero(mealDraft.fatG),
      memo: mealDraft.memo
    };
    saveMealLog(meal);
    const nextState = { ...state, meals: [...state.meals, meal] };
    commitRevision(nextState, "meal_logged", meal);
    setMealDraft(emptyMealDraft);
    setMessage("식사를 기록하고 남은 끼니 목표를 다시 계산했습니다.");
  }

  if (!state || !plan) {
    return <div className="text-sm text-slate-600">식단 계획을 불러오는 중입니다.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">식단</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Nutrition Plan</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          AI가 숫자를 만들지 않습니다. 목표값, 오늘 운동 여부, 실제 식사 기록을 deterministic하게
          재분배합니다.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="칼로리" value={`${plan.totalCalories} kcal`} />
        <Metric label="단백질" value={`${plan.proteinG} g`} />
        <Metric label="탄수화물" value={`${plan.carbsG} g`} />
        <Metric label="지방" value={`${plan.fatG} g`} />
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <Utensils size={18} className="text-mint" aria-hidden />
          <h2 className="text-lg font-semibold">남은 끼니 목표</h2>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Object.entries(plan.mealTargets).map(([meal, target]) => (
            <article key={meal} className="rounded-md bg-panel p-3">
              <h3 className="font-semibold">{meal}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {target.calories} kcal / 단백질 {target.proteinG}g / 탄수 {target.carbsG}g / 지방{" "}
                {target.fatG}g
              </p>
            </article>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {plan.notes.map((note) => (
            <p key={note} className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {note}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <h2 className="text-lg font-semibold">식사 기록</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-6">
          <Select
            label="끼니"
            value={mealDraft.mealName}
            options={["아침", "점심", "저녁", "간식"]}
            onChange={(mealName) => setMealDraft((current) => ({ ...current, mealName }))}
          />
          <Input label="kcal" value={mealDraft.calories} onChange={(calories) => setMealDraft((current) => ({ ...current, calories }))} />
          <Input label="단백질" value={mealDraft.proteinG} onChange={(proteinG) => setMealDraft((current) => ({ ...current, proteinG }))} />
          <Input label="탄수" value={mealDraft.carbsG} onChange={(carbsG) => setMealDraft((current) => ({ ...current, carbsG }))} />
          <Input label="지방" value={mealDraft.fatG} onChange={(fatG) => setMealDraft((current) => ({ ...current, fatG }))} />
          <button
            type="button"
            onClick={addMeal}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white md:mt-6"
          >
            <Plus size={17} aria-hidden />
            추가
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {state.meals.map((meal) => (
            <p key={meal.id} className="rounded-md bg-panel px-3 py-2 text-sm text-slate-700">
              {meal.mealName}: {meal.calories} kcal / P {meal.proteinG} / C {meal.carbsG} / F{" "}
              {meal.fatG}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">식단 목표 설정</h2>
          <button
            type="button"
            onClick={saveProfile}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white"
          >
            <Save size={16} aria-hidden />
            저장
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <ProfileNumber label="기준 kcal" value={profile.startingTargetCalories} onChange={(startingTargetCalories) => setProfile((current) => ({ ...current, startingTargetCalories }))} />
          <ProfileNumber label="단백질 g" value={profile.targetProteinG} onChange={(targetProteinG) => setProfile((current) => ({ ...current, targetProteinG }))} />
          <ProfileNumber label="탄수 g" value={profile.targetCarbsG} onChange={(targetCarbsG) => setProfile((current) => ({ ...current, targetCarbsG }))} />
          <ProfileNumber label="지방 g" value={profile.targetFatG} onChange={(targetFatG) => setProfile((current) => ({ ...current, targetFatG }))} />
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <h2 className="text-lg font-semibold">보조제 체크리스트</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {supplements.map((supplement) => (
            <article key={supplement.id} className="rounded-md bg-panel p-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={supplement.enabled}
                  onChange={(event) =>
                    saveSupplementList(
                      supplements.map((item) =>
                        item.id === supplement.id
                          ? { ...item, enabled: event.target.checked }
                          : item
                      )
                    )
                  }
                />
                {supplement.supplementName}
              </label>
              <input
                value={supplement.userConfiguredDose}
                placeholder="사용자가 정한 용량"
                onChange={(event) =>
                  setSupplements((current) =>
                    current.map((item) =>
                      item.id === supplement.id
                        ? { ...item, userConfiguredDose: event.target.value }
                        : item
                    )
                  )
                }
                onBlur={() => saveSupplementList(supplements)}
                className="mt-2 min-h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                {supplement.preferredTiming} / {supplement.frequency}
              </p>
            </article>
          ))}
        </div>
        {plan.supplementChecklist.length > 0 ? (
          <div className="mt-4 space-y-2">
            {plan.supplementChecklist.map((item) => (
              <p key={item} className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {item}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      {message ? (
        <p className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-soft">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
      />
    </label>
  );
}

function ProfileNumber({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

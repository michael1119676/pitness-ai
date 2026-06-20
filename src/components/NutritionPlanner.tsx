"use client";

import { Check, Clock, Copy, Plus, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DailyNutritionPlan, MealLog } from "@/lib/daily-types";
import {
  buildDailyPlanSnapshot,
  loadDailyPlanningState,
  type DailyPlanningState
} from "@/lib/daily-plan-client";
import {
  appendDailyPlanRevision,
  clearMealDraft,
  emptyMealDraftState,
  loadAllMealLogs,
  loadFavoriteMeals,
  loadLatestDailyPlanRevision,
  loadMealDraft,
  saveFavoriteMeals,
  saveMealDraft,
  saveMealLog,
  type FavoriteMealTemplate,
  type MealDraftState
} from "@/lib/local-store";
import { getNextMealName } from "@/lib/mobile-ui";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function toDraft(meal: MealLog | FavoriteMealTemplate): MealDraftState {
  return {
    mealName: meal.mealName,
    calories: String(meal.calories),
    proteinG: String(meal.proteinG),
    carbsG: String(meal.carbsG),
    fatG: String(meal.fatG),
    memo: meal.memo,
    saveAsFavorite: false
  };
}

function remaining(plan: DailyNutritionPlan, meals: MealLog[]) {
  const consumed = meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.calories,
      proteinG: sum.proteinG + meal.proteinG,
      carbsG: sum.carbsG + meal.carbsG,
      fatG: sum.fatG + meal.fatG
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
  return {
    consumed,
    calories: Math.max(0, plan.totalCalories - consumed.calories),
    proteinG: Math.max(0, plan.proteinG - consumed.proteinG),
    carbsG: Math.max(0, plan.carbsG - consumed.carbsG),
    fatG: Math.max(0, plan.fatG - consumed.fatG),
    percent: Math.min(100, Math.round((consumed.calories / Math.max(1, plan.totalCalories)) * 100))
  };
}

export function NutritionPlanner() {
  const [state, setState] = useState<DailyPlanningState | null>(null);
  const [plan, setPlan] = useState<DailyNutritionPlan | null>(null);
  const [draft, setDraft] = useState<MealDraftState>(emptyMealDraftState);
  const [favorites, setFavorites] = useState<FavoriteMealTemplate[]>([]);
  const [allMeals, setAllMeals] = useState<MealLog[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const loaded = loadDailyPlanningState();
    const latestRevision = loadLatestDailyPlanRevision(loaded.date);
    const snapshot = buildDailyPlanSnapshot(loaded, latestRevision?.trainingDecisionSnapshot ?? null);
    const savedDraft = loadMealDraft();
    setState(loaded);
    setPlan(snapshot.nutritionPlan);
    setDraft({
      ...savedDraft,
      mealName: savedDraft.mealName || getNextMealName()
    });
    setFavorites(loadFavoriteMeals());
    setAllMeals(loadAllMealLogs());
  }, []);

  useEffect(() => {
    saveMealDraft(draft);
  }, [draft]);

  function refresh(nextState: DailyPlanningState) {
    const latestRevision = loadLatestDailyPlanRevision(nextState.date);
    const snapshot = buildDailyPlanSnapshot(nextState, latestRevision?.trainingDecisionSnapshot ?? null);
    setState(nextState);
    setPlan(snapshot.nutritionPlan);
    return snapshot;
  }

  function commitRevision(nextState: DailyPlanningState, meal: MealLog) {
    const snapshot = refresh(nextState);
    appendDailyPlanRevision({
      id: makeId("revision"),
      date: nextState.date,
      triggerType: "meal_logged",
      triggerPayload: meal,
      trainingDecisionSnapshot: snapshot.decision,
      finalWorkoutPlanSnapshot: snapshot.plan,
      nutritionPlanSnapshot: snapshot.nutritionPlan,
      createdAt: new Date().toISOString()
    });
  }

  function saveDraftAsMeal(nextDraft = draft) {
    if (!state) return;
    const meal: MealLog = {
      id: makeId("meal"),
      loggedAt: new Date().toISOString(),
      mealName: nextDraft.mealName,
      calories: numberOrZero(nextDraft.calories),
      proteinG: numberOrZero(nextDraft.proteinG),
      carbsG: numberOrZero(nextDraft.carbsG),
      fatG: numberOrZero(nextDraft.fatG),
      memo: nextDraft.memo
    };
    saveMealLog(meal);
    const nextAllMeals = [...allMeals, meal];
    const nextState = { ...state, meals: [...state.meals, meal] };
    setAllMeals(nextAllMeals);
    if (nextDraft.saveAsFavorite) {
      const nextFavorites = [
        {
          id: makeId("favorite"),
          label: `${meal.mealName} ${meal.calories}kcal`,
          mealName: meal.mealName,
          calories: meal.calories,
          proteinG: meal.proteinG,
          carbsG: meal.carbsG,
          fatG: meal.fatG,
          memo: meal.memo,
          createdAt: new Date().toISOString()
        },
        ...favorites
      ].slice(0, 12);
      saveFavoriteMeals(nextFavorites);
      setFavorites(nextFavorites);
    }
    commitRevision(nextState, meal);
    clearMealDraft();
    setDraft({ ...emptyMealDraftState, mealName: getNextMealName() });
    setSheetOpen(false);
    setToast(`${meal.mealName}을 저장했습니다. 남은 목표를 다시 계산했어요.`);
    window.setTimeout(() => setToast(""), 2800);
  }

  const recentMeals = useMemo(
    () =>
      allMeals
        .slice()
        .reverse()
        .filter((meal, index, array) => array.findIndex((candidate) => candidate.mealName === meal.mealName && candidate.calories === meal.calories && candidate.proteinG === meal.proteinG) === index)
        .slice(0, 4),
    [allMeals]
  );
  const yesterdayMeals = allMeals.filter((meal) => meal.loggedAt.startsWith(yesterdayKey()));

  if (!state || !plan) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-md bg-white shadow-soft" />
        <div className="h-72 animate-pulse rounded-md bg-white shadow-soft" />
      </div>
    );
  }

  const remainingValues = remaining(plan, state.meals);
  const mealOrder = ["아침", "점심", "간식", "저녁"];
  const guidance =
    plan.notes[0] ??
    `${remainingValues.carbsG}g 탄수화물, ${remainingValues.fatG}g 지방 안에서 다음 식사를 맞추세요.`;

  return (
    <div className="space-y-4">
      <section className="rounded-md bg-ink p-5 text-white shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">식단</p>
        <h1 className="mt-2 text-3xl font-semibold">남은 칼로리 {remainingValues.calories}kcal</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">단백질 {remainingValues.proteinG}g 남았습니다.</p>
        <div className="mt-4 h-2 rounded-full bg-white/10">
          <div className="h-2 rounded-full bg-mint" style={{ width: `${remainingValues.percent}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <DarkMini label="단백질" value={`${remainingValues.proteinG}g`} />
          <DarkMini label="탄수" value={`${remainingValues.carbsG}g`} />
          <DarkMini label="지방" value={`${remainingValues.fatG}g`} />
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <h2 className="font-semibold">다음 식사 안내</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{guidance}</p>
      </section>

      <section className="space-y-2">
        {mealOrder.map((mealName) => {
          const logged = state.meals.filter((meal) => meal.mealName === mealName);
          const target = plan.mealTargets[mealName];
          const calories = logged.reduce((sum, meal) => sum + meal.calories, 0);
          const protein = logged.reduce((sum, meal) => sum + meal.proteinG, 0);
          return (
            <article key={mealName} className="rounded-md border border-line bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{mealName}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {logged.length > 0 ? `${calories}kcal · 단백질 ${protein}g` : `${target?.calories ?? 0}kcal 목표`}
                  </p>
                </div>
                <span className={`grid size-9 place-items-center rounded-md ${logged.length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-panel text-slate-400"}`}>
                  <Check size={17} aria-hidden />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 md:bottom-4">
        <button type="button" onClick={() => setSheetOpen(true)} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-base font-semibold text-white shadow-soft">
          <Plus size={19} aria-hidden />
          식사 기록하기
        </button>
      </div>

      {toast ? (
        <p className="fixed inset-x-4 bottom-[calc(9.25rem+env(safe-area-inset-bottom))] z-50 rounded-md bg-emerald-600 px-3 py-3 text-center text-sm font-semibold text-white shadow-soft md:inset-x-auto md:right-4 md:w-96">
          {toast}
        </p>
      ) : null}

      {sheetOpen ? (
        <MealSheet
          draft={draft}
          setDraft={setDraft}
          recentMeals={recentMeals}
          favoriteMeals={favorites}
          yesterdayMeals={yesterdayMeals}
          onClose={() => setSheetOpen(false)}
          onUse={(meal) => setDraft(toDraft(meal))}
          onSave={() => saveDraftAsMeal()}
        />
      ) : null}
    </div>
  );
}

function MealSheet({
  draft,
  setDraft,
  recentMeals,
  favoriteMeals,
  yesterdayMeals,
  onClose,
  onUse,
  onSave
}: {
  draft: MealDraftState;
  setDraft: (draft: MealDraftState | ((current: MealDraftState) => MealDraftState)) => void;
  recentMeals: MealLog[];
  favoriteMeals: FavoriteMealTemplate[];
  yesterdayMeals: MealLog[];
  onClose: () => void;
  onUse: (meal: MealLog | FavoriteMealTemplate) => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-3">
      <section className="max-h-[88vh] w-full overflow-y-auto rounded-t-md bg-white p-4 shadow-soft md:mx-auto md:max-w-lg md:rounded-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">빠른 기록</p>
            <h2 className="text-lg font-semibold">식사 기록하기</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-md bg-panel">
            <X size={18} aria-hidden />
          </button>
        </div>

        <QuickGroup title="최근 식사" icon={Clock} items={recentMeals} onUse={onUse} empty="최근 식사가 아직 없습니다." />
        <QuickGroup title="즐겨찾기" icon={Star} items={favoriteMeals} onUse={onUse} empty="즐겨찾기로 저장한 식사가 없습니다." />
        <QuickGroup title="어제 복사" icon={Copy} items={yesterdayMeals} onUse={onUse} empty="어제 기록한 식사가 없습니다." />

        <div className="mt-4 rounded-md bg-panel p-3">
          <p className="text-sm font-semibold">탄단지 직접 입력</p>
          <div className="mt-3 grid gap-3">
            <label className="text-sm font-medium text-slate-700">
              식사 종류
              <select value={draft.mealName} onChange={(event) => setDraft((current) => ({ ...current, mealName: event.target.value }))} className="mt-1 min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm">
                {["아침", "점심", "간식", "저녁"].map((meal) => (
                  <option key={meal} value={meal}>{meal}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <MacroInput label="칼로리" value={draft.calories} onChange={(calories) => setDraft((current) => ({ ...current, calories }))} />
              <MacroInput label="단백질" value={draft.proteinG} onChange={(proteinG) => setDraft((current) => ({ ...current, proteinG }))} />
              <MacroInput label="탄수화물" value={draft.carbsG} onChange={(carbsG) => setDraft((current) => ({ ...current, carbsG }))} />
              <MacroInput label="지방" value={draft.fatG} onChange={(fatG) => setDraft((current) => ({ ...current, fatG }))} />
            </div>
            <label className="text-sm font-medium text-slate-700">
              메모
              <input value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} className="mt-1 min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm" />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={draft.saveAsFavorite} onChange={(event) => setDraft((current) => ({ ...current, saveAsFavorite: event.target.checked }))} />
              즐겨찾기로 저장
            </label>
          </div>
        </div>

        <button type="button" onClick={onSave} className="mt-4 min-h-12 w-full rounded-md bg-ink px-4 text-base font-semibold text-white">
          저장
        </button>
      </section>
    </div>
  );
}

function QuickGroup({
  title,
  icon: Icon,
  items,
  onUse,
  empty
}: {
  title: string;
  icon: typeof Clock;
  items: Array<MealLog | FavoriteMealTemplate>;
  onUse: (meal: MealLog | FavoriteMealTemplate) => void;
  empty: string;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={16} className="text-mint" aria-hidden />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {items.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.slice(0, 6).map((meal) => (
            <button key={meal.id} type="button" onClick={() => onUse(meal)} className="min-w-36 rounded-md border border-line bg-white px-3 py-2 text-left">
              <p className="truncate text-sm font-semibold">{"label" in meal ? meal.label : meal.mealName}</p>
              <p className="mt-1 text-xs text-slate-500">{meal.calories}kcal · P {meal.proteinG}g</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-panel px-3 py-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function MacroInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="mt-1 min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm"
      />
    </label>
  );
}

function DarkMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/10 px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

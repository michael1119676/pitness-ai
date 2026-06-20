"use client";

import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Ban, Check, Dumbbell, RefreshCcw, Timer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AvoidableBodyPart, WorkoutSetLog } from "@/lib/daily-types";
import { formatBodyPart, toggleBodyPart } from "@/lib/daily-planning";
import {
  buildDailyPlanSnapshot,
  loadDailyPlanningState,
  type DailyPlanningState
} from "@/lib/daily-plan-client";
import {
  appendDailyPlanRevision,
  loadLatestDailyPlanRevision,
  loadWorkoutSession,
  saveDailyCheckIn,
  saveEquipment,
  saveWorkoutLogs,
  saveWorkoutSession,
  type WorkoutUiSession
} from "@/lib/local-store";
import { countPlanSets, formatMinutes, intensityLabels, summarizeFocusMuscles } from "@/lib/mobile-ui";
import type { Equipment, WorkoutPlan, WorkoutPlanItem } from "@/lib/types";
import { adjustRecommendedWeight, findReplacementExercise } from "@/lib/workout-engine";

type Snapshot = ReturnType<typeof buildDailyPlanSnapshot>;
type ReplacementIntent = "swap" | "unavailable";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function numeric(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullable(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function defaultDraft(item: WorkoutPlanItem) {
  return {
    weight: item.recommended_weight_lbs ? String(item.recommended_weight_lbs) : "",
    reps: String(item.rep_max),
    rir: "2",
    rpe: ""
  };
}

function getRecentSet(logs: WorkoutSetLog[], item: WorkoutPlanItem) {
  return logs
    .slice()
    .reverse()
    .find((log) => log.exerciseId === item.exercise.id && log.wasCompleted);
}

function secondsLeft(restEndsAt: string | null) {
  if (!restEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - Date.now()) / 1000));
}

export function WorkoutPlanner() {
  const [state, setState] = useState<DailyPlanningState | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [items, setItems] = useState<WorkoutPlanItem[]>([]);
  const [session, setSession] = useState<WorkoutUiSession | null>(null);
  const [message, setMessage] = useState("");
  const [replacement, setReplacement] = useState<{
    item: WorkoutPlanItem;
    intent: ReplacementIntent;
    candidates: WorkoutPlanItem[];
  } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const loaded = loadDailyPlanningState();
    const latestRevision = loadLatestDailyPlanRevision(loaded.date);
    const built = buildDailyPlanSnapshot(loaded, latestRevision?.trainingDecisionSnapshot ?? null);
    const planItems = latestRevision?.finalWorkoutPlanSnapshot?.items ?? built.plan.items;
    const loadedSession = loadWorkoutSession(loaded.date);
    setState(loaded);
    setSnapshot(built);
    setItems(planItems);
    setSession(loadedSession);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const completedLogs = useMemo(
    () => state?.workoutLogs.filter((log) => log.performedAt.startsWith(state.date) && log.wasCompleted) ?? [],
    [state]
  );

  const progress = useMemo(() => {
    const total = countPlanSets(items);
    const completed = completedLogs.length;
    return {
      completed,
      total,
      percent: total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100))
    };
  }, [completedLogs.length, items]);

  const currentIndex = useMemo(() => {
    if (!session?.currentItemId) return 0;
    return Math.max(0, items.findIndex((item) => item.id === session.currentItemId));
  }, [items, session?.currentItemId]);
  const currentItem = items[currentIndex] ?? items[0] ?? null;
  const restLeft = secondsLeft(session?.restEndsAt ?? null);
  void now;

  function persistSession(nextSession: WorkoutUiSession) {
    setSession(nextSession);
    saveWorkoutSession(nextSession);
  }

  function commitRevision(planItems: WorkoutPlanItem[], triggerType: string, triggerPayload: unknown, nextState = state, nextSnapshot = snapshot) {
    if (!nextState || !nextSnapshot) return;
    const planSnapshot: WorkoutPlan = {
      ...nextSnapshot.plan,
      items: planItems
    };
    appendDailyPlanRevision({
      id: makeId("revision"),
      date: nextState.date,
      triggerType,
      triggerPayload,
      trainingDecisionSnapshot: nextSnapshot.decision,
      finalWorkoutPlanSnapshot: planSnapshot,
      nutritionPlanSnapshot: nextSnapshot.nutritionPlan,
      createdAt: new Date().toISOString()
    });
  }

  function startWorkout() {
    if (!state || !currentItem) return;
    persistSession({
      date: state.date,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      completedAt: null,
      currentItemId: currentItem.id,
      currentSetIndex: 1,
      restEndsAt: null,
      draft: defaultDraft(currentItem)
    });
  }

  function endWorkout(completed = false) {
    if (!state || !session) return;
    persistSession({
      ...session,
      status: completed ? "completed" : "idle",
      completedAt: completed ? new Date().toISOString() : null,
      restEndsAt: null
    });
    setMessage(completed ? "오늘 운동을 완료했습니다." : "운동을 종료했습니다. 기록은 저장되어 있습니다.");
  }

  function updateDraft(patch: Partial<WorkoutUiSession["draft"]>) {
    if (!session) return;
    persistSession({ ...session, draft: { ...session.draft, ...patch } });
  }

  function moveItem(itemId: string, direction: "up" | "down") {
    const index = items.findIndex((item) => item.id === itemId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    const nextItems = items.slice();
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    setItems(nextItems);
    commitRevision(nextItems, "workout_order_changed", { itemId, direction });
  }

  function candidatesFor(item: WorkoutPlanItem, intent: ReplacementIntent) {
    if (!state || !snapshot) return [];
    const candidates: WorkoutPlanItem[] = [];
    const excluded = new Set(items.map((planItem) => planItem.exercise.id));
    for (let index = 0; index < 3; index += 1) {
      const candidate = findReplacementExercise({
        currentItem: item,
        input: snapshot.input,
        equipment: state.equipment,
        excludedExerciseIds: Array.from(excluded),
        avoidCurrentEquipment: intent === "unavailable",
        forbiddenMuscles: snapshot.context.hardConstraints.forbiddenMuscles,
        forbiddenMovementFamilies: snapshot.context.hardConstraints.forbiddenMovementFamilies
      });
      if (!candidate) break;
      candidates.push(candidate);
      excluded.add(candidate.exercise.id);
    }
    return candidates;
  }

  function openReplacement(item: WorkoutPlanItem, intent: ReplacementIntent) {
    setReplacement({ item, intent, candidates: candidatesFor(item, intent) });
  }

  function applyReplacement(nextItem: WorkoutPlanItem) {
    if (!replacement || !state || !session) return;
    let nextEquipment: Equipment[] | null = null;
    if (replacement.intent === "unavailable") {
      const unavailableIds = new Set(replacement.item.equipment.map((equipment) => equipment.id));
      nextEquipment = state.equipment.map((equipment) =>
        unavailableIds.has(equipment.id) ? { ...equipment, is_available: false } : equipment
      );
      saveEquipment(nextEquipment);
    }
    const nextItems = items.map((item) => (item.id === replacement.item.id ? nextItem : item));
    setItems(nextItems);
    const nextState = nextEquipment ? { ...state, equipment: nextEquipment } : state;
    setState(nextState);
    if (session.currentItemId === replacement.item.id) {
      persistSession({ ...session, currentItemId: nextItem.id, draft: defaultDraft(nextItem) });
    }
    commitRevision(nextItems, replacement.intent === "unavailable" ? "equipment_unavailable" : "exercise_replaced", {
      from: replacement.item.exercise.id,
      to: nextItem.exercise.id
    }, nextState);
    setReplacement(null);
    setMessage(`${nextItem.exercise.name}로 교체했습니다.`);
  }

  function adjustItem(direction: "down" | "up", item = currentItem) {
    if (!item) return;
    const nextItem = adjustRecommendedWeight(item, direction);
    const nextItems = items.map((candidate) => (candidate.id === item.id ? nextItem : candidate));
    setItems(nextItems);
    if (session?.currentItemId === item.id) {
      persistSession({ ...session, draft: { ...session.draft, weight: String(nextItem.recommended_weight_lbs ?? "") } });
    }
    commitRevision(nextItems, direction === "down" ? "too_heavy" : "too_easy", { exerciseId: item.exercise.id });
  }

  function removeItem(item: WorkoutPlanItem, reason = "exercise_avoided_today") {
    if (!session) return;
    const nextItems = items.filter((candidate) => candidate.id !== item.id);
    setItems(nextItems);
    const nextCurrent = session.currentItemId === item.id ? nextItems[currentIndex] ?? nextItems[currentIndex - 1] ?? null : null;
    persistSession({
      ...session,
      currentItemId: nextCurrent ? nextCurrent.id : session.currentItemId,
      draft: nextCurrent ? defaultDraft(nextCurrent) : session.draft
    });
    commitRevision(nextItems, reason, { exerciseId: item.exercise.id });
  }

  function avoidMuscleToday(item: WorkoutPlanItem) {
    if (!state) return;
    const part = item.exercise.primary_muscle as AvoidableBodyPart;
    const nextCheckIn = {
      ...state.checkIn,
      avoidMusclesToday: state.checkIn.avoidMusclesToday.includes(part)
        ? state.checkIn.avoidMusclesToday
        : toggleBodyPart(state.checkIn.avoidMusclesToday, part)
    };
    saveDailyCheckIn(nextCheckIn);
    setState({ ...state, checkIn: nextCheckIn });
    removeItem(item, "avoid_muscle_added");
    setMessage(`${formatBodyPart(part)}는 오늘 제외했습니다.`);
  }

  function completeSet() {
    if (!state || !session || !currentItem) return;
    const reps = numeric(session.draft.reps, 0);
    if (reps <= 0) {
      setMessage("반복수를 입력하면 세트를 저장할 수 있습니다.");
      return;
    }
    const weight = numeric(session.draft.weight, currentItem.recommended_weight_lbs ?? 0);
    const rir = nullable(session.draft.rir);
    const rpe = nullable(session.draft.rpe);
    const log: WorkoutSetLog = {
      id: makeId("set"),
      performedAt: new Date().toISOString(),
      exerciseId: currentItem.exercise.id,
      equipmentId: currentItem.equipment[0]?.id ?? "",
      weight,
      reps,
      rir,
      rpe,
      isFailure: rir === 0 || (rpe !== null && rpe >= 10),
      wasCompleted: true,
      wasSkipped: false,
      replacementReason: null,
      notes: ""
    };
    const allLogs = [...state.workoutLogs, log];
    const nextState = { ...state, workoutLogs: allLogs };
    saveWorkoutLogs(allLogs);
    setState(nextState);

    const nextSetIndex = session.currentSetIndex + 1;
    const restEndsAt = new Date(Date.now() + currentItem.rest_seconds * 1000).toISOString();
    if (nextSetIndex <= currentItem.sets) {
      persistSession({
        ...session,
        currentSetIndex: nextSetIndex,
        restEndsAt,
        draft: { ...session.draft, weight: String(weight), reps: String(reps), rir: "2" }
      });
    } else {
      const nextItem = items[currentIndex + 1] ?? null;
      if (nextItem) {
        persistSession({
          ...session,
          currentItemId: nextItem.id,
          currentSetIndex: 1,
          restEndsAt,
          draft: defaultDraft(nextItem)
        });
      } else {
        persistSession({
          ...session,
          status: "completed",
          completedAt: new Date().toISOString(),
          restEndsAt: null
        });
        setMessage("오늘 루틴을 모두 완료했습니다.");
      }
    }
    commitRevision(items, "workout_set_logged", { exerciseId: currentItem.exercise.id, weight, reps, rir, rpe }, nextState);
  }

  if (!state || !snapshot || !session) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-md bg-white shadow-soft" />
        <div className="h-72 animate-pulse rounded-md bg-white shadow-soft" />
      </div>
    );
  }

  const focus = summarizeFocusMuscles(snapshot.decision);

  if (session.status === "in_progress" && currentItem) {
    const lastSet = getRecentSet(state.workoutLogs.filter((log) => !log.performedAt.startsWith(state.date)), currentItem);
    const itemProgress = `${currentIndex + 1} / ${items.length}`;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-ink text-white">
        <header className="border-b border-white/10 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => endWorkout(false)} className="grid size-11 place-items-center rounded-md bg-white/10" aria-label="운동 종료">
              <ArrowLeft size={20} aria-hidden />
            </button>
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-400">현재 진행 {itemProgress}</p>
              <p className="text-sm font-semibold">{progress.completed}/{progress.total}세트</p>
            </div>
            <button type="button" onClick={() => endWorkout(true)} className="grid size-11 place-items-center rounded-md bg-white/10" aria-label="완료">
              <Check size={20} aria-hidden />
            </button>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-mint" style={{ width: `${progress.percent}%` }} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5">
          {restLeft > 0 ? (
            <div className="mb-4 rounded-md bg-white/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Timer size={17} aria-hidden />
                  휴식
                </span>
                <span className="text-3xl font-bold tabular-nums">{restLeft}s</span>
              </div>
            </div>
          ) : null}

          <section className="rounded-md bg-white p-4 text-ink">
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">{formatBodyPart(currentItem.exercise.primary_muscle)}</p>
            <h1 className="mt-2 text-3xl font-semibold">{currentItem.exercise.name}</h1>
            <p className="mt-2 text-sm font-medium text-slate-600">
              {currentItem.equipment.map((equipment) => equipment.name).join(", ")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Info label="오늘 추천" value={`${currentItem.recommended_weight_lbs ?? 0}lb · ${currentItem.rep_min}-${currentItem.rep_max}회`} />
              <Info label="현재 세트" value={`${session.currentSetIndex}/${currentItem.sets}`} />
              <Info label="지난 기록" value={lastSet ? `${lastSet.weight}lb × ${lastSet.reps}` : "첫 기록"} />
              <Info label="강도" value={intensityLabels[snapshot.decision.overallIntensity]} />
            </div>
          </section>

          <section className="mt-4 rounded-md bg-white p-4 text-ink">
            <div className="grid gap-3">
              <Stepper label="중량" value={session.draft.weight} suffix="lb" step={5} onChange={(weight) => updateDraft({ weight })} />
              <Stepper label="반복수" value={session.draft.reps} step={1} onChange={(reps) => updateDraft({ reps })} />
              <Stepper label="RIR" value={session.draft.rir} step={1} onChange={(rir) => updateDraft({ rir })} />
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-2">
            <FocusAction icon={AlertTriangle} label="자리 없음" onClick={() => openReplacement(currentItem, "unavailable")} />
            <FocusAction icon={RefreshCcw} label="운동 교체" onClick={() => openReplacement(currentItem, "swap")} />
            <FocusAction icon={ArrowDown} label="너무 무거움" onClick={() => adjustItem("down")} />
            <FocusAction icon={ArrowUp} label="너무 쉬움" onClick={() => adjustItem("up")} />
            <FocusAction icon={Ban} label="건너뛰기" onClick={() => removeItem(currentItem, "exercise_skipped")} />
            <FocusAction icon={X} label="부위 제외" onClick={() => avoidMuscleToday(currentItem)} />
          </section>

          {message ? <p className="mt-4 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white">{message}</p> : null}
        </main>

        <footer className="border-t border-white/10 bg-ink px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={completeSet} className="min-h-14 w-full rounded-md bg-mint text-lg font-bold text-white">
            세트 완료
          </button>
        </footer>

        <ReplacementSheet replacement={replacement} onClose={() => setReplacement(null)} onPick={applyReplacement} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md bg-ink p-5 text-white shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">오늘 운동</p>
        <h1 className="mt-2 text-3xl font-semibold">{focus}</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <DarkMini label="예상" value={formatMinutes(snapshot.decision.estimatedDurationMinutes)} />
          <DarkMini label="운동" value={`${items.length}개`} />
          <DarkMini label="세트" value={`${countPlanSets(items)}세트`} />
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-3">
          <SummaryRow label="선택된 부위" value={focus} />
          <SummaryRow
            label="제외된 부위"
            value={
              snapshot.decision.excludedMuscles.length > 0
                ? snapshot.decision.excludedMuscles.slice(0, 4).map((item) => formatBodyPart(item.muscle)).join(" · ")
                : "없음"
            }
          />
        </div>
      </section>

      <section className="space-y-2">
        {items.map((item, index) => (
          <article key={item.id} className="rounded-md border border-line bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">{index + 1}번째</p>
                <h2 className="mt-1 truncate text-lg font-semibold">{item.exercise.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{item.equipment.map((equipment) => equipment.name).join(", ")}</p>
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {item.sets}세트 · {item.rep_min}-{item.rep_max}회 · {formatBodyPart(item.exercise.primary_muscle)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => moveItem(item.id, "up")} className="grid size-10 place-items-center rounded-md bg-panel" aria-label="순서 올리기">
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button type="button" onClick={() => moveItem(item.id, "down")} className="grid size-10 place-items-center rounded-md bg-panel" aria-label="순서 내리기">
                  <ArrowDown size={16} aria-hidden />
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => openReplacement(item, "swap")} className="min-h-10 flex-1 rounded-md border border-line bg-panel px-3 text-sm font-semibold text-slate-700">
                운동 교체
              </button>
              <button type="button" onClick={() => removeItem(item)} className="min-h-10 flex-1 rounded-md border border-line bg-panel px-3 text-sm font-semibold text-slate-700">
                오늘 제외
              </button>
            </div>
          </article>
        ))}
      </section>

      {items.length === 0 ? (
        <div className="rounded-md border border-line bg-white p-6 text-sm leading-6 text-slate-600 shadow-soft">
          오늘 조건에서는 실행 가능한 운동이 없습니다. Today에서 피할 부위를 줄이거나 휴식을 선택하세요.
        </div>
      ) : null}

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 md:bottom-4">
        <button type="button" onClick={startWorkout} disabled={items.length === 0} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-base font-semibold text-white shadow-soft disabled:opacity-50">
          <Dumbbell size={19} aria-hidden />
          운동 시작
        </button>
      </div>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
      <ReplacementSheet replacement={replacement} onClose={() => setReplacement(null)} onPick={applyReplacement} />
    </div>
  );
}

function ReplacementSheet({
  replacement,
  onClose,
  onPick
}: {
  replacement: { item: WorkoutPlanItem; intent: ReplacementIntent; candidates: WorkoutPlanItem[] } | null;
  onClose: () => void;
  onPick: (item: WorkoutPlanItem) => void;
}) {
  if (!replacement) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 p-3">
      <section className="w-full rounded-t-md bg-white p-4 text-ink shadow-soft md:mx-auto md:max-w-lg md:rounded-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">대체 운동</p>
            <h2 className="text-lg font-semibold">{replacement.item.exercise.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-md bg-panel">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {replacement.candidates.length > 0 ? (
            replacement.candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onPick(candidate)}
                className="w-full rounded-md border border-line bg-white p-3 text-left"
              >
                <p className="font-semibold">{candidate.exercise.name}</p>
                <p className="mt-1 text-sm text-slate-600">{candidate.equipment.map((equipment) => equipment.name).join(", ")}</p>
                <p className="mt-2 text-xs font-semibold text-mint">
                  {candidate.exercise.primary_muscle === replacement.item.exercise.primary_muscle ? "동일 부위" : "보조 부위 대체"} · {candidate.reason.split(".")[0]}
                </p>
              </button>
            ))
          ) : (
            <p className="rounded-md bg-panel px-3 py-3 text-sm leading-6 text-slate-600">
              등록된 사용 가능 기구 안에서 대체 운동을 찾지 못했습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stepper({
  label,
  value,
  suffix = "",
  step,
  onChange
}: {
  label: string;
  value: string;
  suffix?: string;
  step: number;
  onChange: (value: string) => void;
}) {
  const current = numeric(value, 0);
  return (
    <div>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <div className="mt-2 grid grid-cols-[3rem_1fr_3rem] gap-2">
        <button type="button" onClick={() => onChange(String(Math.max(0, current - step)))} className="min-h-12 rounded-md bg-panel text-2xl font-semibold">
          -
        </button>
        <div className="relative">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            inputMode="decimal"
            className="min-h-12 w-full rounded-md border border-line bg-white px-3 text-center text-2xl font-bold"
          />
          {suffix ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">{suffix}</span> : null}
        </div>
        <button type="button" onClick={() => onChange(String(current + step))} className="min-h-12 rounded-md bg-panel text-2xl font-semibold">
          +
        </button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function FocusAction({ icon: Icon, label, onClick }: { icon: typeof Dumbbell; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold text-white">
      <Icon size={17} aria-hidden />
      {label}
    </button>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-panel px-3 py-3">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-right text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

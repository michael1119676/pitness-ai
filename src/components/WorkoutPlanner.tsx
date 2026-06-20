"use client";

import {
  AlertTriangle,
  Ban,
  Dumbbell,
  RefreshCcw,
  RotateCcw,
  Save,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AvoidableBodyPart, DailyTrainingDecision, WorkoutSetLog } from "@/lib/daily-types";
import { formatBodyPart, toggleBodyPart } from "@/lib/daily-planning";
import {
  buildDailyPlanSnapshot,
  loadDailyPlanningState,
  type DailyPlanningState
} from "@/lib/daily-plan-client";
import { titleCase } from "@/lib/format";
import {
  appendDailyPlanRevision,
  loadLatestDailyPlanRevision,
  saveDailyCheckIn,
  saveEquipment,
  saveWorkoutLogs
} from "@/lib/local-store";
import type { WorkoutPlan, WorkoutPlanItem } from "@/lib/types";
import {
  adjustRecommendedWeight,
  findReplacementExercise
} from "@/lib/workout-engine";

type Snapshot = ReturnType<typeof buildDailyPlanSnapshot>;

type SetDraft = {
  weight: string;
  reps: string;
  rir: string;
  rpe: string;
};

const emptySetDraft: SetDraft = {
  weight: "",
  reps: "",
  rir: "",
  rpe: ""
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function itemTouchesMuscle(item: WorkoutPlanItem, muscle: string) {
  return (
    item.exercise.primary_muscle === muscle
    || item.exercise.target_region === muscle
    || item.exercise.secondary_muscles.some((secondary) => secondary === muscle)
  );
}

function estimateEndTime(items: WorkoutPlanItem[], loggedSetCount: number) {
  const remainingSets = items.reduce((sum, item) => sum + item.sets, 0) - loggedSetCount;
  const minutes = Math.max(0, Math.ceil(remainingSets * 4.5));
  const date = new Date(Date.now() + minutes * 60_000);
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function WorkoutPlanner() {
  const [state, setState] = useState<DailyPlanningState | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [items, setItems] = useState<WorkoutPlanItem[]>([]);
  const [setDrafts, setSetDrafts] = useState<Record<string, SetDraft>>({});
  const [sessionLogs, setSessionLogs] = useState<WorkoutSetLog[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loaded = loadDailyPlanningState();
    const latestRevision = loadLatestDailyPlanRevision(loaded.date);
    const built = buildDailyPlanSnapshot(
      loaded,
      latestRevision?.trainingDecisionSnapshot ?? null
    );
    setState(loaded);
    setSnapshot(built);
    setItems(built.plan.items);
    setSessionLogs(
      loaded.workoutLogs.filter((log) => log.performedAt.startsWith(loaded.date))
    );
  }, []);

  const progress = useMemo(() => {
    const completed = sessionLogs.filter((log) => log.wasCompleted && !log.wasSkipped);
    const loggedByExercise = new Map<string, number>();
    completed.forEach((log) => {
      loggedByExercise.set(log.exerciseId, (loggedByExercise.get(log.exerciseId) ?? 0) + 1);
    });

    const effectiveByMuscle = new Map<string, number>();
    completed.forEach((log) => {
      const item = items.find((candidate) => candidate.exercise.id === log.exerciseId);
      if (!item) return;
      effectiveByMuscle.set(
        item.exercise.primary_muscle,
        (effectiveByMuscle.get(item.exercise.primary_muscle) ?? 0) + 1
      );
      item.exercise.secondary_muscles.forEach((muscle) => {
        effectiveByMuscle.set(muscle, (effectiveByMuscle.get(muscle) ?? 0) + 0.45);
      });
    });

    const totalTargetSets = items.reduce((sum, item) => sum + item.sets, 0);
    return {
      completedSetCount: completed.length,
      totalTargetSets,
      percent:
        totalTargetSets === 0
          ? 0
          : Math.min(100, Math.round((completed.length / totalTargetSets) * 100)),
      loggedByExercise,
      effectiveByMuscle
    };
  }, [items, sessionLogs]);

  function commitRevision({
    nextState,
    nextSnapshot,
    planItems,
    triggerType,
    triggerPayload
  }: {
    nextState: DailyPlanningState;
    nextSnapshot: Snapshot;
    planItems: WorkoutPlanItem[];
    triggerType: string;
    triggerPayload: unknown;
  }) {
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

  function refreshPlan(nextState: DailyPlanningState, decision?: DailyTrainingDecision | null) {
    const nextSnapshot = buildDailyPlanSnapshot(nextState, decision ?? null);
    setState(nextState);
    setSnapshot(nextSnapshot);
    setItems(nextSnapshot.plan.items);
    return nextSnapshot;
  }

  function replaceItem(item: WorkoutPlanItem, avoidCurrentEquipment: boolean) {
    if (!state || !snapshot) return;
    const replacement = findReplacementExercise({
      currentItem: item,
      input: snapshot.input,
      equipment: state.equipment,
      excludedExerciseIds: items.map((planItem) => planItem.exercise.id),
      avoidCurrentEquipment,
      forbiddenMuscles: snapshot.context.hardConstraints.forbiddenMuscles,
      forbiddenMovementFamilies: snapshot.context.hardConstraints.forbiddenMovementFamilies
    });

    if (!replacement) {
      setMessage("같은 목적을 만족하는 대체 운동을 찾지 못했습니다.");
      return;
    }

    const nextItems = items.map((planItem) => (planItem.id === item.id ? replacement : planItem));
    setItems(nextItems);
    commitRevision({
      nextState: state,
      nextSnapshot: snapshot,
      planItems: nextItems,
      triggerType: "exercise_replaced",
      triggerPayload: { from: item.exercise.id, to: replacement.exercise.id }
    });
    setMessage(`${replacement.exercise.name}로 교체했습니다.`);
  }

  function markEquipmentUnavailable(item: WorkoutPlanItem) {
    if (!state || !snapshot) return;
    const equipmentIds = item.equipment.map((equipment) => equipment.id);
    const nextEquipment = state.equipment.map((equipment) =>
      equipmentIds.includes(equipment.id) ? { ...equipment, is_available: false } : equipment
    );
    const nextState = { ...state, equipment: nextEquipment };
    saveEquipment(nextEquipment);
    setState(nextState);

    const replacement = findReplacementExercise({
      currentItem: item,
      input: {
        ...snapshot.input,
        temporarilyUnavailableEquipmentIds: [
          ...snapshot.input.temporarilyUnavailableEquipmentIds,
          ...equipmentIds
        ]
      },
      equipment: nextEquipment,
      excludedExerciseIds: items.map((planItem) => planItem.exercise.id),
      avoidCurrentEquipment: true,
      forbiddenMuscles: snapshot.context.hardConstraints.forbiddenMuscles,
      forbiddenMovementFamilies: snapshot.context.hardConstraints.forbiddenMovementFamilies
    });

    const nextItems = replacement
      ? items.map((planItem) => (planItem.id === item.id ? replacement : planItem))
      : items.filter((planItem) => planItem.id !== item.id);
    setItems(nextItems);
    commitRevision({
      nextState,
      nextSnapshot: snapshot,
      planItems: nextItems,
      triggerType: "equipment_unavailable",
      triggerPayload: { equipmentIds, replacementExerciseId: replacement?.exercise.id ?? null }
    });
    setMessage(
      replacement
        ? `${item.equipment[0]?.name ?? "기구"} 사용 불가를 반영해 ${replacement.exercise.name}로 바꿨습니다.`
        : "기구 사용 불가를 반영해 해당 운동을 제외했습니다."
    );
  }

  function adjustItem(item: WorkoutPlanItem, direction: "down" | "up") {
    const nextItem = adjustRecommendedWeight(item, direction);
    const nextItems = items.map((planItem) => (planItem.id === item.id ? nextItem : planItem));
    setItems(nextItems);
    if (state && snapshot) {
      commitRevision({
        nextState: state,
        nextSnapshot: snapshot,
        planItems: nextItems,
        triggerType: direction === "down" ? "too_heavy" : "too_easy",
        triggerPayload: { exerciseId: item.exercise.id }
      });
    }
  }

  function skipItem(item: WorkoutPlanItem) {
    if (!state || !snapshot) return;
    const skipped: WorkoutSetLog = {
      id: makeId("set"),
      performedAt: new Date().toISOString(),
      exerciseId: item.exercise.id,
      equipmentId: item.equipment[0]?.id ?? "",
      weight: 0,
      reps: 0,
      rir: null,
      rpe: null,
      isFailure: false,
      wasCompleted: false,
      wasSkipped: true,
      replacementReason: "사용자가 운동을 스킵했습니다.",
      notes: ""
    };
    const allLogs = [...state.workoutLogs, skipped];
    saveWorkoutLogs(allLogs);
    const nextState = { ...state, workoutLogs: allLogs };
    const nextItems = items.filter((planItem) => planItem.id !== item.id);
    setState(nextState);
    setItems(nextItems);
    setSessionLogs((current) => [...current, skipped]);
    commitRevision({
      nextState,
      nextSnapshot: snapshot,
      planItems: nextItems,
      triggerType: "exercise_skipped",
      triggerPayload: { exerciseId: item.exercise.id }
    });
    setMessage(`${item.exercise.name}을 오늘 루틴에서 제외했습니다.`);
  }

  function avoidMuscleForToday(item: WorkoutPlanItem) {
    if (!state) return;
    const part = item.exercise.primary_muscle as AvoidableBodyPart;
    const avoidMusclesToday = state.checkIn.avoidMusclesToday.includes(part)
      ? state.checkIn.avoidMusclesToday
      : toggleBodyPart(state.checkIn.avoidMusclesToday, part);
    const nextCheckIn = { ...state.checkIn, avoidMusclesToday };
    saveDailyCheckIn(nextCheckIn);
    const nextState = { ...state, checkIn: nextCheckIn };
    const nextSnapshot = refreshPlan(nextState, null);
    commitRevision({
      nextState,
      nextSnapshot,
      planItems: nextSnapshot.plan.items,
      triggerType: "avoid_muscle_added",
      triggerPayload: { muscle: part }
    });
    setMessage(`${formatBodyPart(part)}를 오늘 제외하고 남은 루틴을 다시 만들었습니다.`);
  }

  function removeExerciseOnly(item: WorkoutPlanItem) {
    const nextItems = items.filter((planItem) => planItem.id !== item.id);
    setItems(nextItems);
    if (state && snapshot) {
      commitRevision({
        nextState: state,
        nextSnapshot: snapshot,
        planItems: nextItems,
        triggerType: "exercise_avoided_today",
        triggerPayload: { exerciseId: item.exercise.id }
      });
    }
    setMessage(`${item.exercise.name}만 오늘 제외했습니다.`);
  }

  function updateDraft(itemId: string, patch: Partial<SetDraft>) {
    setSetDrafts((current) => ({
      ...current,
      [itemId]: { ...(current[itemId] ?? emptySetDraft), ...patch }
    }));
  }

  function logSet(item: WorkoutPlanItem) {
    if (!state || !snapshot) return;
    const draft = setDrafts[item.id] ?? emptySetDraft;
    const weight = numberOrZero(draft.weight || String(item.recommended_weight_lbs ?? 0));
    const reps = numberOrZero(draft.reps);
    const rir = nullableNumber(draft.rir);
    const rpe = nullableNumber(draft.rpe);

    if (reps <= 0) {
      setMessage("반복수를 입력한 뒤 세트를 저장하세요.");
      return;
    }

    const log: WorkoutSetLog = {
      id: makeId("set"),
      performedAt: new Date().toISOString(),
      exerciseId: item.exercise.id,
      equipmentId: item.equipment[0]?.id ?? "",
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
    setSessionLogs((current) => [...current, log]);
    setSetDrafts((current) => ({ ...current, [item.id]: emptySetDraft }));
    commitRevision({
      nextState,
      nextSnapshot: snapshot,
      planItems: items,
      triggerType: "workout_set_logged",
      triggerPayload: { exerciseId: item.exercise.id, weight, reps, rir, rpe }
    });
    setMessage(`${item.exercise.name} 세트를 저장했습니다.`);
  }

  if (!state || !snapshot) {
    return <div className="text-sm text-slate-600">오늘 루틴을 불러오는 중입니다.</div>;
  }

  const { decision, context } = snapshot;
  const excludedLabels = decision.excludedMuscles
    .slice(0, 8)
    .map((item) => `${formatBodyPart(item.muscle)}: ${item.reason}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mint">오늘 AI가 정한 운동</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{decision.sessionTitle}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {decision.reasoningSummary[0] ?? "오늘 체크인과 최근 기록을 기준으로 부위 중심 루틴을 만들었습니다."}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white px-4 py-3 shadow-soft">
          <p className="text-xs font-semibold text-slate-500">진행률</p>
          <p className="mt-1 text-2xl font-semibold">{progress.percent}%</p>
          <p className="text-xs text-slate-500">
            예상 종료 {estimateEndTime(items, progress.completedSetCount)}
          </p>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="강도" value={decision.overallIntensity} />
        <Metric label="예상 시간" value={`${decision.estimatedDurationMinutes}분`} />
        <Metric label="목표 세트" value={`${progress.totalTargetSets}세트`} />
        <Metric label="기구 모드" value={context.hardConstraints.equipmentMode} />
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">선택된 부위</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {decision.selectedMuscles.map((muscle) => (
                <span key={muscle.muscle} className="rounded-md bg-panel px-2 py-1 text-xs font-semibold">
                  {formatBodyPart(muscle.muscle)} {muscle.targetEffectiveSets}세트
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">제외된 부위</p>
            <div className="mt-2 space-y-1">
              {(excludedLabels.length > 0
                ? excludedLabels
                : context.hardConstraints.forbiddenMuscles.map((part) => formatBodyPart(part))
              ).map((label) => (
                <p key={label} className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-coral">
                  {label}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {decision.reasoningSummary.slice(0, 6).map((reason) => (
            <p key={reason} className="rounded-md bg-panel px-3 py-2 text-sm leading-6 text-slate-700">
              {reason}
            </p>
          ))}
        </div>
      </section>

      {context.hardConstraints.painMuscles.length > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          통증으로 기록된 부위는 제외했습니다. 통증이 강하거나 지속되면 운동을 중단하고 전문가 상담을 고려하세요.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-soft">
          {message}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
        <div className="space-y-3">
          {items.map((item) => {
            const draft = setDrafts[item.id] ?? emptySetDraft;
            const loggedSets = progress.loggedByExercise.get(item.exercise.id) ?? 0;
            const muscleAvoided = context.hardConstraints.forbiddenMuscles.some((muscle) =>
              itemTouchesMuscle(item, muscle)
            );

            return (
              <article key={item.id} className="rounded-md border border-line bg-white p-4 shadow-soft">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-mint">
                      {item.slot.label}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">{item.exercise.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.equipment.map((equipment) => equipment.name).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge>{formatBodyPart(item.exercise.primary_muscle)}</Badge>
                    <Badge>{titleCase(item.exercise.movement_family)}</Badge>
                    <Badge>
                      {loggedSets}/{item.sets}세트
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <Mini label="반복" value={`${item.rep_min}-${item.rep_max}회`} />
                  <Mini label="추천 중량" value={item.recommended_weight_lbs ? `${item.recommended_weight_lbs} lb` : "-"} />
                  <Mini label="휴식" value={`${item.rest_seconds}초`} />
                  <Mini label="점수" value={String(Math.round(item.score))} />
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">{item.reason}</p>

                {muscleAvoided ? (
                  <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-coral">
                    현재 hard constraint와 겹치는 운동입니다. 재계획을 권장합니다.
                  </p>
                ) : null}

                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  <Input
                    label="중량"
                    value={draft.weight}
                    placeholder={item.recommended_weight_lbs ? String(item.recommended_weight_lbs) : "0"}
                    onChange={(weight) => updateDraft(item.id, { weight })}
                  />
                  <Input
                    label="반복"
                    value={draft.reps}
                    placeholder={String(item.rep_max)}
                    onChange={(reps) => updateDraft(item.id, { reps })}
                  />
                  <Input
                    label="RIR"
                    value={draft.rir}
                    placeholder="2"
                    onChange={(rir) => updateDraft(item.id, { rir })}
                  />
                  <Input
                    label="RPE"
                    value={draft.rpe}
                    placeholder="8"
                    onChange={(rpe) => updateDraft(item.id, { rpe })}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton icon={Save} label="세트 저장" onClick={() => logSet(item)} />
                  <ActionButton icon={AlertTriangle} label="기구 사용 불가" onClick={() => markEquipmentUnavailable(item)} />
                  <ActionButton icon={RefreshCcw} label="운동 교체" onClick={() => replaceItem(item, false)} />
                  <ActionButton icon={TrendingDown} label="무거움" onClick={() => adjustItem(item, "down")} />
                  <ActionButton icon={TrendingUp} label="쉬움" onClick={() => adjustItem(item, "up")} />
                  <ActionButton icon={Ban} label="스킵" onClick={() => skipItem(item)} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <ActionButton icon={Ban} label="이 운동만 제외" onClick={() => removeExerciseOnly(item)} />
                  <ActionButton icon={Dumbbell} label="이 기구 제외" onClick={() => markEquipmentUnavailable(item)} />
                  <ActionButton icon={RotateCcw} label="부위 전체 제외" onClick={() => avoidMuscleForToday(item)} />
                </div>
              </article>
            );
          })}

          {items.length === 0 ? (
            <div className="rounded-md border border-line bg-white p-6 text-sm text-slate-600 shadow-soft">
              오늘 조건에서는 실행 가능한 운동이 없습니다. 체크인에서 금지 부위를 줄이거나 휴식을 선택하세요.
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <div className="rounded-md border border-line bg-white p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">부위별 실제 유효 세트</p>
            <div className="mt-3 space-y-2">
              {decision.selectedMuscles.map((target) => {
                const done = progress.effectiveByMuscle.get(target.muscle) ?? 0;
                return (
                  <div key={target.muscle}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{formatBodyPart(target.muscle)}</span>
                      <span className="font-semibold">
                        {Math.round(done * 10) / 10}/{target.targetEffectiveSets}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-panel">
                      <div
                        className="h-2 rounded-full bg-mint"
                        style={{
                          width: `${Math.min(100, (done / Math.max(1, target.targetEffectiveSets)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-line bg-white p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">오늘 반영한 근거</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <li>최근 운동 이력: {decision.evidenceKeys.includes("muscleHistory.weeklyVolumeDeficit") ? "부위별 볼륨 부족분 반영" : "요약 데이터 반영"}</li>
              <li>인바디: {context.inBodyTrend.summary[0] ?? "기록 부족"}</li>
              <li>일정: {state.checkIn.scheduleConstraints.length}개 제약 반영</li>
              <li>금지 부위: {context.hardConstraints.forbiddenMuscles.length}개 hard constraint</li>
            </ul>
          </div>
        </aside>
      </section>
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

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-panel px-2 py-1 text-xs font-semibold text-slate-600">
      {children}
    </span>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel px-2 py-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
      />
    </label>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold text-slate-700"
    >
      <Icon size={16} aria-hidden />
      {label}
    </button>
  );
}

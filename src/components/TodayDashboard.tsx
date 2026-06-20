"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bed,
  Brain,
  CalendarDays,
  Dumbbell,
  Plus,
  Utensils,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AvoidableBodyPart,
  DailyTrainingDecision,
  ScheduleActivityType
} from "@/lib/daily-types";
import {
  avoidBodyPartOptions,
  bodyPartLabels,
  formatBodyPart,
  makeScheduleConstraintId,
  summarizeScheduleConstraint,
  toggleBodyPart
} from "@/lib/daily-planning";
import {
  buildDailyPlanSnapshot,
  loadDailyPlanningState,
  type DailyPlanningState
} from "@/lib/daily-plan-client";
import {
  appendDailyPlanRevision,
  loadDailyPlanRevisions,
  saveDailyCheckIn
} from "@/lib/local-store";

type Snapshot = ReturnType<typeof buildDailyPlanSnapshot>;

const activityOptions: ScheduleActivityType[] = [
  "long_walk",
  "running",
  "hiking",
  "sports",
  "prolonged_standing",
  "physical_labor"
];

export function TodayDashboard() {
  const [state, setState] = useState<DailyPlanningState | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revisions, setRevisions] = useState<ReturnType<typeof loadDailyPlanRevisions>>([]);
  const [decisionSource, setDecisionSource] = useState("로컬 fallback");
  const [message, setMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<{
    activityType: ScheduleActivityType;
    expectedDurationMinutes: number;
    intensity: "low" | "normal" | "high";
    affectedMuscles: AvoidableBodyPart[];
    memo: string;
  }>({
    activityType: "long_walk" as ScheduleActivityType,
    expectedDurationMinutes: 60,
    intensity: "normal",
    affectedMuscles: ["lower_body"] as AvoidableBodyPart[],
    memo: ""
  });

  useEffect(() => {
    const loaded = loadDailyPlanningState();
    setState(loaded);
    setSnapshot(buildDailyPlanSnapshot(loaded));
    setRevisions(loadDailyPlanRevisions(loaded.date));
  }, []);

  const stats = useMemo(() => {
    const equipment = state?.equipment ?? [];
    return {
      total: equipment.length,
      available: equipment.filter((item) => item.is_available).length,
      preferred: equipment.filter((item) => item.user_preference === "preferred").length,
      disabled: equipment.filter((item) => item.user_preference === "disabled").length
    };
  }, [state]);

  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(new Date());

  function refresh(nextState: DailyPlanningState, decision?: DailyTrainingDecision | null) {
    const nextSnapshot = buildDailyPlanSnapshot(nextState, decision ?? null);
    setState(nextState);
    setSnapshot(nextSnapshot);
    return nextSnapshot;
  }

  function commitRevision({
    nextState,
    nextSnapshot,
    triggerType,
    triggerPayload
  }: {
    nextState: DailyPlanningState;
    nextSnapshot: Snapshot;
    triggerType: string;
    triggerPayload: unknown;
  }) {
    appendDailyPlanRevision({
      id: `revision-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      date: nextState.date,
      triggerType,
      triggerPayload,
      trainingDecisionSnapshot: nextSnapshot.decision,
      finalWorkoutPlanSnapshot: nextSnapshot.plan,
      nutritionPlanSnapshot: nextSnapshot.nutritionPlan,
      createdAt: new Date().toISOString()
    });
    setRevisions(loadDailyPlanRevisions(nextState.date));
  }

  function patchCheckIn(
    patch: Partial<DailyPlanningState["checkIn"]>,
    triggerType = "check_in_updated"
  ) {
    if (!state) return;
    const nextCheckIn = { ...state.checkIn, ...patch };
    saveDailyCheckIn(nextCheckIn);
    const nextState = { ...state, checkIn: nextCheckIn };
    const nextSnapshot = refresh(nextState);
    commitRevision({ nextState, nextSnapshot, triggerType, triggerPayload: patch });
    setDecisionSource("로컬 fallback");
  }

  function toggleSorenessPart(part: AvoidableBodyPart) {
    if (!state) return;
    const selected = state.checkIn.sorenessMuscles.includes(part);
    const sorenessLevel = { ...state.checkIn.sorenessLevel };
    if (selected) {
      delete sorenessLevel[String(part)];
    } else {
      sorenessLevel[String(part)] = sorenessLevel[String(part)] ?? 5;
    }
    patchCheckIn(
      {
        sorenessMuscles: toggleBodyPart(state.checkIn.sorenessMuscles, part),
        sorenessLevel
      },
      "soreness_muscles_changed"
    );
  }

  function togglePainPart(part: AvoidableBodyPart) {
    if (!state) return;
    const selected = state.checkIn.painMuscles.includes(part);
    const painLevel = { ...state.checkIn.painLevel };
    if (selected) {
      delete painLevel[String(part)];
    } else {
      painLevel[String(part)] = painLevel[String(part)] ?? 7;
    }
    patchCheckIn(
      {
        painMuscles: toggleBodyPart(state.checkIn.painMuscles, part),
        painLevel
      },
      "pain_muscles_changed"
    );
  }

  function addScheduleConstraint() {
    if (!state) return;
    patchCheckIn(
      {
        scheduleConstraints: [
          ...state.checkIn.scheduleConstraints,
          {
            id: makeScheduleConstraintId(),
            date: state.checkIn.date,
            activityType: scheduleDraft.activityType,
            expectedDurationMinutes: scheduleDraft.expectedDurationMinutes,
            intensity: scheduleDraft.intensity,
            affectedMuscles: scheduleDraft.affectedMuscles,
            memo: scheduleDraft.memo
          }
        ]
      },
      "schedule_constraint_added"
    );
    setMessage("오늘 일정 제약을 반영했습니다.");
  }

  async function askAi() {
    if (!state || !snapshot) return;
    setIsAiLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/ai/training-focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: snapshot.context })
      });
      const result = (await response.json()) as {
        decision?: DailyTrainingDecision;
        source?: "openai" | "fallback";
        message?: string;
      };

      if (!response.ok || !result.decision) {
        throw new Error(result.message ?? "AI 판단을 받지 못했습니다.");
      }

      const nextSnapshot = refresh(state, result.decision);
      commitRevision({
        nextState: state,
        nextSnapshot,
        triggerType: "ai_training_focus_generated",
        triggerPayload: { source: result.source ?? "fallback" }
      });
      setDecisionSource(result.source === "openai" ? "OpenAI" : "로컬 fallback");
      setMessage(result.message ?? "오늘 판단을 갱신했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 판단 요청 중 오류가 발생했습니다.");
    } finally {
      setIsAiLoading(false);
    }
  }

  if (!state || !snapshot) {
    return <div className="text-sm text-slate-600">오늘 데이터를 불러오는 중입니다.</div>;
  }

  const { checkIn } = state;
  const { decision, plan, nutritionPlan, context } = snapshot;
  const latestBody = context.inBodyTrend.latest;
  const currentRevision = revisions.at(-1) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mint">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">오늘의 체크인</h1>
          <p className="mt-2 text-sm text-slate-600">
            운동 유형을 고르지 않고, 오늘 몸 상태와 일정으로 부위와 움직임을 정합니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={askAi}
            disabled={isAiLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink disabled:opacity-60"
          >
            <Brain size={17} aria-hidden />
            {isAiLoading ? "판단 중" : "AI 판단"}
          </button>
          <Link
            href="/workout"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
          >
            루틴 열기
            <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat icon={Wrench} label="등록 기구" value={String(stats.total)} />
        <Stat icon={CalendarDays} label="사용 가능" value={String(stats.available)} />
        <Stat icon={Dumbbell} label="선호 기구" value={String(stats.preferred)} />
        <Stat icon={Bed} label="수면" value={`${Math.round(context.sleepSummary.durationMinutes / 60)}시간`} />
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="flex rounded-md border border-line bg-panel p-1">
              {(["train", "rest"] as const).map((intent) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => patchCheckIn({ trainingIntent: intent }, "training_intent_changed")}
                  className={`min-h-10 flex-1 rounded-md text-sm font-semibold ${
                    checkIn.trainingIntent === intent ? "bg-ink text-white" : "text-slate-600"
                  }`}
                >
                  {intent === "train" ? "운동" : "휴식"}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <label className="text-sm font-medium text-slate-700">
                취침
                <input
                  type="time"
                  value={checkIn.bedTime}
                  onChange={(event) =>
                    patchCheckIn({ bedTime: event.target.value }, "sleep_time_changed")
                  }
                  className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                기상
                <input
                  type="time"
                  value={checkIn.wakeTime}
                  onChange={(event) =>
                    patchCheckIn({ wakeTime: event.target.value }, "sleep_time_changed")
                  }
                  className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                />
              </label>
              <NumberField
                label="운동 가능 시간"
                value={checkIn.availableTimeMinutes}
                min={20}
                max={100}
                unit="분"
                onChange={(availableTimeMinutes) =>
                  patchCheckIn({ availableTimeMinutes }, "available_time_changed")
                }
              />
              <NumberField
                label="수면 질"
                value={checkIn.sleepQuality}
                min={1}
                max={5}
                onChange={(sleepQuality) => patchCheckIn({ sleepQuality }, "condition_changed")}
              />
              <NumberField
                label="컨디션"
                value={checkIn.conditionScore}
                min={1}
                max={10}
                onChange={(conditionScore) =>
                  patchCheckIn({ conditionScore }, "condition_changed")
                }
              />
              <label className="text-sm font-medium text-slate-700">
                운동 시작
                <input
                  type="time"
                  value={checkIn.preferredWorkoutStartTime}
                  onChange={(event) =>
                    patchCheckIn(
                      { preferredWorkoutStartTime: event.target.value },
                      "preferred_start_time_changed"
                    )
                  }
                  className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                />
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">오늘 피할 부위</legend>
              <div className="mt-2 flex flex-wrap gap-1">
                {avoidBodyPartOptions.map((part) => {
                  const selected = checkIn.avoidMusclesToday.includes(part);
                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() =>
                        patchCheckIn({
                          avoidMusclesToday: toggleBodyPart(checkIn.avoidMusclesToday, part)
                        }, "avoid_muscles_changed")
                      }
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        selected
                          ? "border-coral bg-rose-50 text-coral"
                          : "border-line bg-panel text-slate-600"
                      }`}
                    >
                      {bodyPartLabels[part] ?? part}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">근육통 부위</legend>
              <div className="mt-2 flex flex-wrap gap-1">
                {avoidBodyPartOptions.slice(5).map((part) => {
                  const selected = checkIn.sorenessMuscles.includes(part);
                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() => toggleSorenessPart(part)}
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        selected
                          ? "border-amber-400 bg-amber-50 text-amber-800"
                          : "border-line bg-panel text-slate-600"
                      }`}
                    >
                      {bodyPartLabels[part] ?? part}
                    </button>
                  );
                })}
              </div>
              {checkIn.sorenessMuscles.length > 0 ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {checkIn.sorenessMuscles.map((part) => (
                    <NumberField
                      key={part}
                      label={`${bodyPartLabels[part] ?? part} 근육통`}
                      value={checkIn.sorenessLevel[String(part)] ?? 5}
                      min={0}
                      max={10}
                      onChange={(level) =>
                        patchCheckIn(
                          {
                            sorenessLevel: {
                              ...checkIn.sorenessLevel,
                              [String(part)]: level
                            }
                          },
                          "soreness_level_changed"
                        )
                      }
                    />
                  ))}
                </div>
              ) : null}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">통증 부위</legend>
              <div className="mt-2 flex flex-wrap gap-1">
                {avoidBodyPartOptions.slice(5).map((part) => {
                  const selected = checkIn.painMuscles.includes(part);
                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() => togglePainPart(part)}
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        selected
                          ? "border-coral bg-rose-50 text-coral"
                          : "border-line bg-panel text-slate-600"
                      }`}
                    >
                      {bodyPartLabels[part] ?? part}
                    </button>
                  );
                })}
              </div>
              {checkIn.painMuscles.length > 0 ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {checkIn.painMuscles.map((part) => (
                    <NumberField
                      key={part}
                      label={`${bodyPartLabels[part] ?? part} 통증`}
                      value={checkIn.painLevel[String(part)] ?? 7}
                      min={0}
                      max={10}
                      onChange={(level) =>
                        patchCheckIn(
                          {
                            painLevel: {
                              ...checkIn.painLevel,
                              [String(part)]: level
                            }
                          },
                          "pain_level_changed"
                        )
                      }
                    />
                  ))}
                </div>
              ) : null}
            </fieldset>
          </div>

          <div className="rounded-md bg-panel p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">오늘 결정</p>
            <h2 className="mt-1 text-xl font-semibold">{decision.sessionTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {decisionSource} / {decision.overallIntensity} / 예상 {decision.estimatedDurationMinutes}분
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {decision.selectedMuscles.map((item) => (
                <span
                  key={item.muscle}
                  className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink"
                >
                  {formatBodyPart(item.muscle)}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {decision.reasoningSummary.slice(0, 3).map((reason) => (
                <p key={reason} className="text-sm leading-6 text-slate-700">
                  {reason}
                </p>
              ))}
            </div>
            {context.hardConstraints.forbiddenMuscles.length > 0 ? (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-coral">
                제외: {context.hardConstraints.forbiddenMuscles.map(formatBodyPart).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">일정 제약</p>
            <h2 className="mt-1 text-lg font-semibold">오늘 오래 걷거나 서는 일정</h2>
          </div>
          <button
            type="button"
            onClick={addScheduleConstraint}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white"
          >
            <Plus size={16} aria-hidden />
            추가
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <SelectField
            label="일정"
            value={scheduleDraft.activityType}
            options={activityOptions}
            onChange={(activityType) => setScheduleDraft((current) => ({ ...current, activityType }))}
          />
          <NumberField
            label="예상 시간"
            value={scheduleDraft.expectedDurationMinutes}
            min={10}
            max={240}
            unit="분"
            onChange={(expectedDurationMinutes) =>
              setScheduleDraft((current) => ({ ...current, expectedDurationMinutes }))
            }
          />
          <SelectField
            label="강도"
            value={scheduleDraft.intensity}
            options={["low", "normal", "high"] as const}
            onChange={(intensity) => setScheduleDraft((current) => ({ ...current, intensity }))}
          />
          <SelectField
            label="영향 부위"
            value={scheduleDraft.affectedMuscles[0] ?? "lower_body"}
            options={avoidBodyPartOptions}
            labels={bodyPartLabels}
            onChange={(part) =>
              setScheduleDraft((current) => ({ ...current, affectedMuscles: [part] }))
            }
          />
        </div>
        <div className="mt-3 space-y-2">
          {checkIn.scheduleConstraints.map((constraint) => (
            <p key={constraint.id} className="rounded-md bg-panel px-3 py-2 text-sm text-slate-700">
              {summarizeScheduleConstraint(constraint)}
            </p>
          ))}
        </div>
      </section>

      {message ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {message}
        </p>
      ) : null}

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">Daily Plan Revision</p>
            <h2 className="mt-1 text-lg font-semibold">
              {currentRevision ? `현재 revision ${currentRevision.revisionNumber}` : "아직 저장된 revision 없음"}
            </h2>
          </div>
          <span className="rounded-md bg-panel px-2 py-1 text-xs font-semibold text-slate-600">
            총 {revisions.length}개
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {revisions.slice(-6).reverse().map((revision) => (
            <div key={revision.id} className="rounded-md bg-panel px-3 py-2 text-sm text-slate-700">
              <p className="font-semibold">#{revision.revisionNumber} {revision.triggerType}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(revision.createdAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-mint">루틴 미리보기</p>
              <h2 className="mt-1 text-xl font-semibold">
                {plan.sessionTitle ?? decision.sessionTitle}
              </h2>
            </div>
            <span className="rounded-md bg-panel px-2 py-1 text-xs font-semibold text-slate-600">
              운동 {plan.items.length}개
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {plan.items.slice(0, 6).map((item) => (
              <article key={item.id} className="rounded-md border border-line bg-panel p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-mint">
                  {item.slot.label}
                </p>
                <h3 className="mt-1 font-semibold">{item.exercise.name}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {item.equipment.map((equipmentItem) => equipmentItem.name).join(", ")}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {item.sets}세트 x {item.rep_min}-{item.rep_max}회
                </p>
              </article>
            ))}
          </div>
          {plan.items.length === 0 ? (
            <p className="mt-4 rounded-md bg-panel px-3 py-3 text-sm text-slate-600">
              오늘 조건으로는 운동 슬롯을 만들지 않았습니다.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <aside className="rounded-md border border-line bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-mint">식단</p>
              <Utensils size={18} className="text-mint" aria-hidden />
            </div>
            <h2 className="mt-1 text-xl font-semibold">{nutritionPlan.totalCalories} kcal</h2>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <MiniMetric label="단백질" value={`${nutritionPlan.proteinG}g`} />
              <MiniMetric label="탄수" value={`${nutritionPlan.carbsG}g`} />
              <MiniMetric label="지방" value={`${nutritionPlan.fatG}g`} />
            </dl>
            <p className="mt-3 text-sm text-slate-600">
              남은 끼니: {Object.keys(nutritionPlan.mealTargets).join(", ") || "없음"}
            </p>
          </aside>

          <aside className="rounded-md border border-line bg-white p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-mint">인바디</p>
            <h2 className="mt-1 text-xl font-semibold">
              {latestBody?.weightKg !== null && latestBody?.weightKg !== undefined
                ? `${latestBody.weightKg} kg`
                : "기록 없음"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {context.inBodyTrend.summary[0] ?? "CSV를 가져오면 추세를 표시합니다."}
            </p>
            <Link
              href="/body/import"
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-panel px-3 text-sm font-semibold text-slate-700"
            >
              CSV 가져오기
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-md border border-line bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <Icon size={18} className="text-mint" aria-hidden />
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <div className="mt-1 flex min-h-11 items-center rounded-md border border-line bg-panel px-3">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
        {unit ? <span className="text-xs font-semibold text-slate-500">{unit}</span> : null}
      </div>
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  labels,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels?: Record<string, string>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel px-2 py-2">
      <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-ink">{value}</dd>
    </div>
  );
}

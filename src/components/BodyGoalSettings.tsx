"use client";

import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AvoidableBodyPart,
  BodyGoalProfile,
  BodyMetricGoal,
  CardioPreference,
  DietAggressiveness,
  MainBodyGoal,
  PreferredTrainingStyle
} from "@/lib/daily-types";
import { avoidBodyPartOptions, formatBodyPart, toggleBodyPart } from "@/lib/daily-planning";
import {
  defaultBodyGoalProfile,
  defaultBodyMetricGoals,
  loadBodyGoalProfile,
  loadBodyMetricGoals,
  saveBodyMetricGoals,
  saveBodyGoalProfile
} from "@/lib/local-store";

const goalLabels: Record<MainBodyGoal, string> = {
  lean_muscular: "선명하고 탄탄한 몸",
  aesthetic_v_taper: "어깨와 등이 넓은 V라인",
  classic_physique: "균형 잡힌 클래식 체형",
  bulk_muscle_gain: "근육량 증가",
  body_recomposition: "체지방 감량 + 근육 유지",
  fat_loss: "체지방 감량",
  athletic_performance: "운동 수행능력",
  lower_body_focus: "하체 중심",
  balanced_health: "균형 건강",
  custom: "직접 설정"
};

const styleLabels: Record<PreferredTrainingStyle, string> = {
  machine_cable: "머신/케이블 중심",
  balanced: "균형",
  strength: "근력",
  hypertrophy: "근비대",
  low_fatigue: "저피로"
};

const dietLabels: Record<DietAggressiveness, string> = {
  conservative: "천천히",
  moderate: "보통",
  aggressive: "빠르게"
};

const cardioLabels: Record<CardioPreference, string> = {
  minimal: "최소",
  moderate: "보통",
  high: "높음"
};

const presets: Array<{ goal: MainBodyGoal; priority: AvoidableBodyPart[]; avoid?: AvoidableBodyPart[] }> = [
  { goal: "aesthetic_v_taper", priority: ["side_delt", "rear_delt", "lats", "upper_back", "upper_chest"] },
  { goal: "body_recomposition", priority: ["upper_chest", "lats", "glutes"], avoid: [] },
  { goal: "lower_body_focus", priority: ["quads", "hamstrings", "glutes", "calves"] },
  { goal: "fat_loss", priority: ["upper_body", "lower_body"], avoid: [] }
];

export function BodyGoalSettings() {
  const [profile, setProfile] = useState<BodyGoalProfile>(defaultBodyGoalProfile);
  const [metricGoals, setMetricGoals] = useState<BodyMetricGoal[]>(defaultBodyMetricGoals);
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProfile(loadBodyGoalProfile());
    setMetricGoals(loadBodyMetricGoals());
  }, []);

  function patch(patchValue: Partial<BodyGoalProfile>) {
    setProfile((current) => ({ ...current, ...patchValue }));
  }

  function applyPreset(goal: MainBodyGoal) {
    const preset = presets.find((item) => item.goal === goal);
    patch({
      mainBodyGoal: goal,
      priorityMuscles: preset?.priority ?? profile.priorityMuscles,
      avoidOverdevelopmentMuscles: preset?.avoid ?? profile.avoidOverdevelopmentMuscles
    });
  }

  function save() {
    saveBodyGoalProfile(profile);
    saveBodyMetricGoals(metricGoals);
    setMessage("목표 체형을 저장했습니다. 오늘 루틴부터 반영됩니다.");
  }

  const skeletalRatioGoal =
    metricGoals.find((goal) => goal.type === "skeletal_muscle_to_weight_ratio")
    ?? defaultBodyMetricGoals[0];

  function updateSkeletalRatioGoal(percentValue: number | null) {
    const nextGoal: BodyMetricGoal = {
      ...skeletalRatioGoal,
      targetValue: percentValue === null ? null : percentValue / 100,
      enabled: true,
      priority: "primary",
      direction: "at_least"
    };
    setMetricGoals((current) => [
      nextGoal,
      ...current.filter((goal) => goal.id !== nextGoal.id && goal.type !== "skeletal_muscle_to_weight_ratio")
    ]);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md bg-ink p-5 text-white shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">목표 체형</p>
        <h1 className="mt-2 text-2xl font-semibold">3단계로 목표 정하기</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className={`h-2 rounded-full ${step >= item ? "bg-mint" : "bg-white/15"}`} />
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        {step === 1 ? (
          <div>
            <h2 className="text-lg font-semibold">어떤 몸을 만들고 싶은가요?</h2>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {presets.map((preset) => (
                <button
                  key={preset.goal}
                  type="button"
                  onClick={() => applyPreset(preset.goal)}
                  className={`min-h-16 rounded-md border px-3 text-left text-sm font-semibold ${
                    profile.mainBodyGoal === preset.goal ? "border-ink bg-panel text-ink" : "border-line bg-white text-slate-700"
                  }`}
                >
                  {goalLabels[preset.goal]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <MusclePicker
              title="우선 키우고 싶은 부위"
              value={profile.priorityMuscles}
              onChange={(priorityMuscles) => patch({ priorityMuscles })}
            />
            <MusclePicker
              title="과하게 키우고 싶지 않은 부위"
              value={profile.avoidOverdevelopmentMuscles}
              onChange={(avoidOverdevelopmentMuscles) => patch({ avoidOverdevelopmentMuscles })}
              tone="avoid"
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">목표 수치와 성향</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <NumberField label="목표 체중" value={profile.targetBodyWeightKg} suffix="kg" onChange={(targetBodyWeightKg) => patch({ targetBodyWeightKg })} />
              <NumberField label="목표 체지방률" value={profile.targetBodyFatPercentage} suffix="%" onChange={(targetBodyFatPercentage) => patch({ targetBodyFatPercentage })} />
              <NumberField label="목표 골격근량" value={profile.targetSkeletalMuscleMassKg} suffix="kg" onChange={(targetSkeletalMuscleMassKg) => patch({ targetSkeletalMuscleMassKg })} />
              <NumberField
                label="체중 대비 골격근량 비율"
                value={skeletalRatioGoal.targetValue === null ? null : Math.round(skeletalRatioGoal.targetValue * 1000) / 10}
                suffix="%"
                onChange={updateSkeletalRatioGoal}
              />
            </div>
            <p className="rounded-md bg-panel px-3 py-2 text-sm leading-6 text-slate-600">
              예: 50을 입력하면 내부 목표는 0.5로 저장됩니다. 이 값은 개인 체형 목표이며 의학적 정상 기준으로 표시하지 않습니다.
            </p>
            <details className="rounded-md bg-panel p-3">
              <summary className="cursor-pointer text-sm font-semibold">고급 설정</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <SelectField label="훈련 성향" value={profile.preferredTrainingStyle} labels={styleLabels} onChange={(preferredTrainingStyle) => patch({ preferredTrainingStyle })} />
                <SelectField label="식단 속도" value={profile.dietAggressiveness} labels={dietLabels} onChange={(dietAggressiveness) => patch({ dietAggressiveness })} />
                <SelectField label="유산소" value={profile.cardioPreference} labels={cardioLabels} onChange={(cardioPreference) => patch({ cardioPreference })} />
              </div>
              <textarea
                value={profile.notes ?? ""}
                onChange={(event) => patch({ notes: event.target.value })}
                rows={3}
                placeholder="메모"
                className="mt-3 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </details>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            <ArrowLeft size={17} aria-hidden />
            이전
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((current) => Math.min(3, current + 1))}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
            >
              다음
              <ArrowRight size={17} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
            >
              <Save size={17} aria-hidden />
              저장
            </button>
          )}
        </div>
      </section>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
    </div>
  );
}

function MusclePicker({
  title,
  value,
  onChange,
  tone = "priority"
}: {
  title: string;
  value: AvoidableBodyPart[];
  onChange: (value: AvoidableBodyPart[]) => void;
  tone?: "priority" | "avoid";
}) {
  return (
    <fieldset>
      <legend className="text-lg font-semibold">{title}</legend>
      <div className="mt-3 flex max-h-64 flex-wrap gap-2 overflow-y-auto">
        {avoidBodyPartOptions.map((part) => {
          const selected = value.includes(part);
          return (
            <button
              key={part}
              type="button"
              onClick={() => onChange(toggleBodyPart(value, part))}
              className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${
                selected
                  ? tone === "priority"
                    ? "border-mint bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-line bg-panel text-slate-600"
              }`}
            >
              {formatBodyPart(part)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  suffix,
  onChange
}: {
  label: string;
  value: number | null;
  suffix: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <div className="relative mt-1">
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
          className="min-h-11 w-full rounded-md border border-line bg-panel px-3 pr-10 text-sm text-ink"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{suffix}</span>
      </div>
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  labels,
  onChange
}: {
  label: string;
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="mt-1 min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm">
        {(Object.keys(labels) as T[]).map((option) => (
          <option key={option} value={option}>{labels[option]}</option>
        ))}
      </select>
    </label>
  );
}

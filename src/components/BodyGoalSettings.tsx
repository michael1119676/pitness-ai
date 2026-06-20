"use client";

import { Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AvoidableBodyPart,
  BodyGoalProfile,
  CardioPreference,
  DietAggressiveness,
  MainBodyGoal,
  PreferredTrainingStyle
} from "@/lib/daily-types";
import { avoidBodyPartOptions, bodyPartLabels, toggleBodyPart } from "@/lib/daily-planning";
import {
  defaultBodyGoalProfile,
  loadBodyGoalProfile,
  saveBodyGoalProfile
} from "@/lib/local-store";

const goalLabels: Record<MainBodyGoal, string> = {
  lean_muscular: "린 머스큘러",
  aesthetic_v_taper: "V taper",
  classic_physique: "클래식 피지크",
  bulk_muscle_gain: "벌크/근육 증가",
  body_recomposition: "바디 리컴포지션",
  fat_loss: "체지방 감량",
  athletic_performance: "운동 수행능력",
  lower_body_focus: "하체 집중",
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
  conservative: "보수적",
  moderate: "보통",
  aggressive: "공격적"
};

const cardioLabels: Record<CardioPreference, string> = {
  minimal: "최소",
  moderate: "보통",
  high: "높음"
};

const vTaperPreset: AvoidableBodyPart[] = [
  "side_delt",
  "rear_delt",
  "lats",
  "upper_back",
  "upper_chest"
];

export function BodyGoalSettings() {
  const [profile, setProfile] = useState<BodyGoalProfile>(defaultBodyGoalProfile);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProfile(loadBodyGoalProfile());
  }, []);

  function patch(patchValue: Partial<BodyGoalProfile>) {
    setProfile((current) => ({ ...current, ...patchValue }));
  }

  function applyPreset(goal: MainBodyGoal) {
    if (goal === "aesthetic_v_taper") {
      patch({ mainBodyGoal: goal, priorityMuscles: vTaperPreset });
      return;
    }
    if (goal === "lower_body_focus") {
      patch({
        mainBodyGoal: goal,
        priorityMuscles: ["quads", "hamstrings", "glutes", "calves"]
      });
      return;
    }
    patch({ mainBodyGoal: goal });
  }

  function save() {
    saveBodyGoalProfile(profile);
    setMessage("목표 체형 설정을 저장했습니다.");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">목표 체형</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Body Goal Profile</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          이 설정은 오늘 운동 부위, 주간 목표 볼륨, 운동 선택 점수, 식단 목표와 코치 설명에
          반영됩니다.
        </p>
      </div>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="주 목표"
            value={profile.mainBodyGoal}
            options={Object.keys(goalLabels) as MainBodyGoal[]}
            labels={goalLabels}
            onChange={applyPreset}
          />
          <SelectField
            label="선호 훈련 스타일"
            value={profile.preferredTrainingStyle}
            options={Object.keys(styleLabels) as PreferredTrainingStyle[]}
            labels={styleLabels}
            onChange={(preferredTrainingStyle) => patch({ preferredTrainingStyle })}
          />
          <SelectField
            label="식단 조정 강도"
            value={profile.dietAggressiveness}
            options={Object.keys(dietLabels) as DietAggressiveness[]}
            labels={dietLabels}
            onChange={(dietAggressiveness) => patch({ dietAggressiveness })}
          />
          <SelectField
            label="유산소 선호"
            value={profile.cardioPreference}
            options={Object.keys(cardioLabels) as CardioPreference[]}
            labels={cardioLabels}
            onChange={(cardioPreference) => patch({ cardioPreference })}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <NumberField
            label="목표 체중(kg)"
            value={profile.targetBodyWeightKg}
            onChange={(targetBodyWeightKg) => patch({ targetBodyWeightKg })}
          />
          <NumberField
            label="목표 체지방률(%)"
            value={profile.targetBodyFatPercentage}
            onChange={(targetBodyFatPercentage) => patch({ targetBodyFatPercentage })}
          />
          <NumberField
            label="목표 골격근량(kg)"
            value={profile.targetSkeletalMuscleMassKg}
            onChange={(targetSkeletalMuscleMassKg) => patch({ targetSkeletalMuscleMassKg })}
          />
          <NumberField
            label="주간 체중 변화(kg)"
            value={profile.weeklyWeightChangeTargetKg}
            allowNegative
            onChange={(weeklyWeightChangeTargetKg) =>
              patch({ weeklyWeightChangeTargetKg: weeklyWeightChangeTargetKg ?? 0 })
            }
          />
        </div>

        <MusclePicker
          title="우선 성장 부위"
          value={profile.priorityMuscles}
          onChange={(priorityMuscles) => patch({ priorityMuscles })}
        />
        <MusclePicker
          title="과발달 방지 부위"
          value={profile.avoidOverdevelopmentMuscles}
          onChange={(avoidOverdevelopmentMuscles) => patch({ avoidOverdevelopmentMuscles })}
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">
          메모
          <textarea
            value={profile.notes}
            onChange={(event) => patch({ notes: event.target.value })}
            rows={4}
            className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
          />
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : <span />}
          <button
            type="button"
            onClick={save}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
          >
            <Save size={17} aria-hidden />
            저장
          </button>
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-mint" aria-hidden />
          <h2 className="text-lg font-semibold">현재 반영 방식</h2>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <Info text="우선 부위는 회복 점수와 주간 볼륨 부족분이 충분할 때만 오늘 후보가 됩니다." />
          <Info text="과발달 방지 부위는 target effective sets와 fallback 점수에서 낮게 평가됩니다." />
          <Info text="인바디는 큰 방향과 좌우 밸런스만 참고하고 세부 부위는 운동 기록을 우선합니다." />
        </div>
      </section>
    </div>
  );
}

function MusclePicker({
  title,
  value,
  onChange
}: {
  title: string;
  value: AvoidableBodyPart[];
  onChange: (value: AvoidableBodyPart[]) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold text-slate-700">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-1">
        {avoidBodyPartOptions.map((part) => {
          const selected = value.includes(part);
          return (
            <button
              key={part}
              type="button"
              onClick={() => onChange(toggleBodyPart(value, part))}
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                selected
                  ? "border-mint bg-emerald-50 text-emerald-700"
                  : "border-line bg-panel text-slate-600"
              }`}
            >
              {bodyPartLabels[part] ?? part}
            </button>
          );
        })}
      </div>
    </fieldset>
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
  labels: Record<T, string>;
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
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  allowNegative,
  onChange
}: {
  label: string;
  value: number | null;
  allowNegative?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type="number"
        min={allowNegative ? undefined : 0}
        step="0.1"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
        className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
      />
    </label>
  );
}

function Info({ text }: { text: string }) {
  return <p className="rounded-md bg-panel px-3 py-2 text-sm leading-6 text-slate-700">{text}</p>;
}

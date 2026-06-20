"use client";

import Link from "next/link";
import { Activity, Goal, RotateCcw, Save, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { CloudSyncPanel } from "@/components/CloudSyncPanel";
import { titleCase } from "@/lib/format";
import {
  defaultSettings,
  loadSettings,
  resetEquipment,
  saveSettings
} from "@/lib/local-store";
import {
  equipmentPreferenceLabels,
  type EquipmentPreferenceMode,
  type Intensity,
  type UserSettings
} from "@/lib/types";

const preferenceModes = Object.keys(equipmentPreferenceLabels) as EquipmentPreferenceMode[];
const intensities: Intensity[] = ["low", "normal", "high"];
const intensityLabels: Record<Intensity, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음"
};

export function SettingsPanel() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const showDebug = process.env.NODE_ENV !== "production";

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function patch(patchValue: Partial<UserSettings>) {
    setSettings((current) => ({ ...current, ...patchValue }));
  }

  function save() {
    saveSettings(settings);
    setMessage("설정을 저장했습니다.");
  }

  function resetSeedEquipment() {
    resetEquipment();
    setMessage("기구 목록을 기본 데이터로 초기화했습니다.");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">설정</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">추천 기본값</h1>
        <p className="mt-2 text-sm text-slate-600">
          사용자가 운동 유형을 고르지 않아도 오늘 체크인과 목표를 기준으로 앱이 부위를 정합니다.
        </p>
      </div>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            기본 운동 시간(분)
            <input
              type="number"
              min={20}
              max={90}
              value={settings.defaultAvailableMinutes}
              onChange={(event) =>
                patch({ defaultAvailableMinutes: Number(event.target.value) })
              }
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
            />
          </label>
          <SelectField
            label="기본 강도"
            value={settings.defaultIntensity}
            options={intensities}
            labels={intensityLabels}
            onChange={(defaultIntensity) => patch({ defaultIntensity })}
          />
          <SelectField
            label="기본 기구 선호 모드"
            value={settings.defaultEquipmentPreference}
            options={preferenceModes}
            labels={equipmentPreferenceLabels}
            onChange={(defaultEquipmentPreference) => patch({ defaultEquipmentPreference })}
          />
        </div>

        {message ? <p className="mt-4 text-sm font-medium text-emerald-700">{message}</p> : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={save}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
          >
            <Save size={17} aria-hidden />
            설정 저장
          </button>
        </div>
      </section>

      {showDebug ? (
        <details className="rounded-md border border-line bg-white p-4 shadow-soft">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            개발자용 동기화 패널
          </summary>
          <div className="mt-4">
            <CloudSyncPanel />
          </div>
        </details>
      ) : null}

      <section className="rounded-md border border-rose-100 bg-white p-4 shadow-soft">
        <h2 className="font-semibold text-rose-800">고급 설정</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          기구 목록 초기화는 현재 헬스장 기구 설정을 기본값으로 되돌립니다.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700"
          >
            <RotateCcw size={17} aria-hidden />
            기구 초기화
          </button>
          {confirmReset ? (
            <button
              type="button"
              onClick={() => {
                resetSeedEquipment();
                setConfirmReset(false);
                setMessage("기구 목록을 기본 데이터로 초기화했습니다.");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-rose-700 px-4 text-sm font-semibold text-white"
            >
              정말 초기화
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <SettingsLink
          href="/goals"
          icon={Goal}
          title="목표 체형"
          body="우선 성장 부위와 과발달 방지 부위를 설정합니다."
        />
        <SettingsLink
          href="/nutrition"
          icon={Utensils}
          title="식단 목표"
          body="칼로리와 탄단지 기준, 보조제 체크리스트를 관리합니다."
        />
        <SettingsLink
          href="/body"
          icon={Activity}
          title="인바디 추세"
          body="CSV 기록과 2~4주 변화 요약을 확인합니다."
        />
      </section>
    </div>
  );
}

function SettingsLink({
  href,
  icon: Icon,
  title,
  body
}: {
  href: string;
  icon: typeof Save;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="rounded-md border border-line bg-white p-4 shadow-soft">
      <Icon size={18} className="text-mint" aria-hidden />
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
    </Link>
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
  labels?: Record<T, string>;
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
            {labels?.[option] ?? titleCase(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

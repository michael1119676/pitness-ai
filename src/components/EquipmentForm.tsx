"use client";

import { useRouter } from "next/navigation";
import { Save, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { equipmentCatalog } from "@/lib/equipment-data";
import { titleCase } from "@/lib/format";
import { loadEquipment, saveEquipment } from "@/lib/local-store";
import {
  angles,
  equipmentTypes,
  fatigueScores,
  loadTypes,
  movementFamilies,
  muscles,
  setupDifficulties,
  stabilityLevels,
  targetRegions,
  userPreferences,
  type Equipment
} from "@/lib/types";

const templateIds = [
  "eq-hs-decline-press",
  "eq-prime-row",
  "eq-leg-extension",
  "eq-seated-leg-curl",
  "eq-dual-cable-station"
];

function makeDraft(): Equipment {
  return {
    id: "draft",
    name: "",
    brand: "",
    model: "",
    category: "",
    equipment_type: "machine",
    load_type: "selectorized",
    primary_muscles: [],
    secondary_muscles: [],
    target_regions: [],
    movement_patterns: [],
    movement_family: [],
    angle: "neutral",
    is_unilateral: false,
    is_plate_loaded: false,
    is_selectorized: true,
    is_cable: false,
    stability_level: "high",
    fatigue_score: "medium",
    setup_difficulty: "low",
    handles_grips: [],
    notes: "",
    user_preference: "neutral",
    is_available: true
  };
}

function toggle<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function EquipmentForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Equipment>(makeDraft);
  const [error, setError] = useState("");

  const templates = useMemo(
    () => templateIds.map((id) => equipmentCatalog.find((item) => item.id === id)).filter(Boolean),
    []
  ) as Equipment[];

  function patch(patchValue: Partial<Equipment>) {
    setDraft((current) => ({ ...current, ...patchValue }));
  }

  function applyTemplate(template: Equipment) {
    setDraft({
      ...template,
      id: "draft",
      name: template.name
    });
    setError("");
  }

  function save() {
    if (!draft.name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!draft.category.trim()) {
      setError("카테고리를 입력해 주세요.");
      return;
    }
    if (draft.primary_muscles.length === 0 || draft.target_regions.length === 0) {
      setError("주동근과 타깃 부위를 각각 하나 이상 선택해 주세요.");
      return;
    }

    const next: Equipment = {
      ...draft,
      id: `custom-${Date.now()}`,
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      category: draft.category.trim()
    };

    saveEquipment([...loadEquipment(), next]);
    router.push("/equipment");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">새 기구</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">머신 또는 스테이션 추가</h1>
      </div>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wand2 size={17} aria-hidden />
          빠른 템플릿
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template)}
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-slate-700"
            >
              {template.name}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="이름" value={draft.name} onChange={(name) => patch({ name })} />
          <TextField
            label="카테고리"
            value={draft.category}
            onChange={(category) => patch({ category })}
            placeholder="예: Chest Press, Cable Station, Row Machine"
          />
          <TextField label="브랜드" value={draft.brand} onChange={(brand) => patch({ brand })} />
          <TextField label="모델" value={draft.model} onChange={(model) => patch({ model })} />

          <SelectField
            label="기구 타입"
            value={draft.equipment_type}
            options={equipmentTypes}
            onChange={(equipment_type) => patch({ equipment_type })}
          />
          <SelectField
            label="로딩 타입"
            value={draft.load_type}
            options={loadTypes}
            onChange={(load_type) =>
              patch({
                load_type,
                is_plate_loaded: load_type === "plate_loaded",
                is_selectorized: load_type === "selectorized",
                is_cable: load_type === "cable_stack"
              })
            }
          />
          <SelectField
            label="각도"
            value={draft.angle === "mixed" ? "neutral" : draft.angle}
            options={angles}
            onChange={(angle) => patch({ angle })}
          />
          <SelectField
            label="선호도"
            value={draft.user_preference}
            options={userPreferences}
            onChange={(user_preference) => patch({ user_preference })}
          />
          <SelectField
            label="안정성"
            value={draft.stability_level}
            options={stabilityLevels}
            onChange={(stability_level) => patch({ stability_level })}
          />
          <SelectField
            label="피로도"
            value={draft.fatigue_score}
            options={fatigueScores}
            onChange={(fatigue_score) => patch({ fatigue_score })}
          />
          <SelectField
            label="세팅 난이도"
            value={draft.setup_difficulty}
            options={setupDifficulties}
            onChange={(setup_difficulty) => patch({ setup_difficulty })}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <ToggleField
            label="편측"
            checked={draft.is_unilateral}
            onChange={(is_unilateral) => patch({ is_unilateral })}
          />
          <ToggleField
            label="원판 로딩"
            checked={draft.is_plate_loaded}
            onChange={(is_plate_loaded) => patch({ is_plate_loaded })}
          />
          <ToggleField
            label="핀 로딩"
            checked={draft.is_selectorized}
            onChange={(is_selectorized) => patch({ is_selectorized })}
          />
          <ToggleField
            label="케이블"
            checked={draft.is_cable}
            onChange={(is_cable) => patch({ is_cable })}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <TagPicker
            label="주동근"
            options={muscles}
            values={draft.primary_muscles}
            onChange={(value) => patch({ primary_muscles: toggle(draft.primary_muscles, value) })}
          />
          <TagPicker
            label="보조 근육"
            options={muscles}
            values={draft.secondary_muscles}
            onChange={(value) =>
              patch({ secondary_muscles: toggle(draft.secondary_muscles, value) })
            }
          />
          <TagPicker
            label="타깃 부위"
            options={targetRegions}
            values={draft.target_regions}
            onChange={(value) => patch({ target_regions: toggle(draft.target_regions, value) })}
          />
          <TagPicker
            label="움직임 계열"
            options={movementFamilies}
            values={draft.movement_family}
            onChange={(value) => patch({ movement_family: toggle(draft.movement_family, value) })}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField
            label="움직임 패턴"
            value={draft.movement_patterns.join(", ")}
            onChange={(value) =>
              patch({
                movement_patterns: value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              })
            }
            placeholder="예: decline_press, iso_lateral_press"
          />
          <TextField
            label="핸들/그립"
            value={draft.handles_grips.join(", ")}
            onChange={(value) =>
              patch({
                handles_grips: value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              })
            }
            placeholder="예: neutral handles, rope, D handles"
          />
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          메모
          <textarea
            value={draft.notes}
            onChange={(event) => patch({ notes: event.target.value })}
            className="mt-1 min-h-24 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
          />
        </label>

        {error ? <p className="mt-4 text-sm font-medium text-coral">{error}</p> : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={save}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
          >
            <Save size={17} aria-hidden />
            기구 저장
          </button>
        </div>
      </section>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {titleCase(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-line bg-panel px-3 text-sm font-medium text-slate-700">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-mint"
      />
    </label>
  );
}

function TagPicker<T extends string>({
  label,
  options,
  values,
  onChange
}: {
  label: string;
  options: readonly T[];
  values: T[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-700">{label}</legend>
      <div className="scrollbar-thin mt-2 flex max-h-36 flex-wrap gap-1 overflow-y-auto">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                selected
                  ? "border-mint bg-emerald-50 text-emerald-700"
                  : "border-line bg-panel text-slate-600"
              }`}
            >
              {titleCase(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

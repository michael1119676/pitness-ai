"use client";

import Link from "next/link";
import { Check, Edit3, Plus, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { equipmentCatalog } from "@/lib/equipment-data";
import { compactList, titleCase } from "@/lib/format";
import { loadEquipment, resetEquipment, saveEquipment } from "@/lib/local-store";
import {
  equipmentTypes,
  loadTypes,
  movementFamilies,
  muscles,
  targetRegions,
  userPreferences,
  type Equipment,
  type MovementFamily,
  type Muscle
} from "@/lib/types";

type Filters = {
  query: string;
  muscle: "all" | Muscle;
  movementFamily: "all" | MovementFamily;
  equipmentType: "all" | Equipment["equipment_type"];
  preference: "all" | Equipment["user_preference"];
};

const initialFilters: Filters = {
  query: "",
  muscle: "all",
  movementFamily: "all",
  equipmentType: "all",
  preference: "all"
};

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function EquipmentManager() {
  const [equipment, setEquipment] = useState<Equipment[]>(equipmentCatalog);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setEquipment(loadEquipment());
  }, []);

  function persist(next: Equipment[]) {
    setEquipment(next);
    saveEquipment(next);
  }

  function updateEquipment(id: string, patch: Partial<Equipment>) {
    persist(equipment.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  const filteredEquipment = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return equipment.filter((item) => {
      const haystack = [
        item.name,
        item.brand,
        item.model,
        item.category,
        item.notes,
        ...item.primary_muscles,
        ...item.secondary_muscles,
        ...item.target_regions,
        ...item.movement_patterns,
        ...item.handles_grips
      ]
        .join(" ")
        .toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (
        filters.muscle !== "all" &&
        !item.primary_muscles.includes(filters.muscle) &&
        !item.secondary_muscles.includes(filters.muscle)
      ) {
        return false;
      }
      if (
        filters.movementFamily !== "all" &&
        !item.movement_family.includes(filters.movementFamily)
      ) {
        return false;
      }
      if (filters.equipmentType !== "all" && item.equipment_type !== filters.equipmentType) {
        return false;
      }
      if (filters.preference !== "all" && item.user_preference !== filters.preference) {
        return false;
      }
      return true;
    });
  }, [equipment, filters]);

  const counts = useMemo(
    () => ({
      total: equipment.length,
      available: equipment.filter((item) => item.is_available).length,
      preferred: equipment.filter((item) => item.user_preference === "preferred").length,
      disabled: equipment.filter((item) => item.user_preference === "disabled").length
    }),
    [equipment]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mint">
            기구 데이터베이스
          </p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">등록된 헬스장 기구</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            전체 {counts.total}개, 사용 가능 {counts.available}개, 선호 {counts.preferred}개,
            비활성 {counts.disabled}개.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => persist(resetEquipment())}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700"
            title="기본 기구 데이터로 초기화"
          >
            <RotateCcw size={16} aria-hidden />
            초기화
          </button>
          <Link
            href="/equipment/new"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white"
          >
            <Plus size={17} aria-hidden />
            추가
          </Link>
        </div>
      </div>

      <section className="rounded-md border border-line bg-white p-3 shadow-soft md:p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal size={17} aria-hidden />
          필터
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <label className="relative md:col-span-2">
            <span className="sr-only">기구 검색</span>
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              className="min-h-11 w-full rounded-md border border-line bg-panel pl-10 pr-3 text-sm"
              placeholder="이름, 브랜드, 태그, 그립 검색"
            />
          </label>
          <select
            value={filters.muscle}
            onChange={(event) =>
              setFilters({ ...filters, muscle: event.target.value as Filters["muscle"] })
            }
            className="min-h-11 rounded-md border border-line bg-panel px-3 text-sm"
            aria-label="근육별 필터"
          >
            <option value="all">전체 근육</option>
            {muscles.map((muscle) => (
              <option key={muscle} value={muscle}>
                {titleCase(muscle)}
              </option>
            ))}
          </select>
          <select
            value={filters.movementFamily}
            onChange={(event) =>
              setFilters({
                ...filters,
                movementFamily: event.target.value as Filters["movementFamily"]
              })
            }
            className="min-h-11 rounded-md border border-line bg-panel px-3 text-sm"
            aria-label="움직임 계열별 필터"
          >
            <option value="all">전체 패턴</option>
            {movementFamilies.map((family) => (
              <option key={family} value={family}>
                {titleCase(family)}
              </option>
            ))}
          </select>
          <select
            value={filters.equipmentType}
            onChange={(event) =>
              setFilters({
                ...filters,
                equipmentType: event.target.value as Filters["equipmentType"]
              })
            }
            className="min-h-11 rounded-md border border-line bg-panel px-3 text-sm"
            aria-label="기구 타입별 필터"
          >
            <option value="all">전체 타입</option>
            {equipmentTypes.map((type) => (
              <option key={type} value={type}>
                {titleCase(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <select
            value={filters.preference}
            onChange={(event) =>
              setFilters({ ...filters, preference: event.target.value as Filters["preference"] })
            }
            className="min-h-11 w-full rounded-md border border-line bg-panel px-3 text-sm md:w-60"
            aria-label="선호도별 필터"
          >
            <option value="all">전체 선호도</option>
            {userPreferences.map((preference) => (
              <option key={preference} value={preference}>
                {titleCase(preference)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {filteredEquipment.map((item) => {
          const editing = editingId === item.id;
          return (
            <article key={item.id} className="rounded-md border border-line bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{item.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {[item.brand, item.model, item.category].filter(Boolean).join(" / ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(editing ? null : item.id)}
                  className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-slate-600"
                  title="기구 태그 편집"
                >
                  <Edit3 size={16} aria-hidden />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-panel px-2 py-1 font-medium">
                  {titleCase(item.equipment_type)}
                </span>
                <span className="rounded-md bg-panel px-2 py-1 font-medium">
                  {titleCase(item.load_type)}
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                  {compactList(item.primary_muscles)}
                </span>
                <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700">
                  {compactList(item.target_regions)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <select
                  value={item.user_preference}
                  onChange={(event) =>
                    updateEquipment(item.id, {
                      user_preference: event.target.value as Equipment["user_preference"]
                    })
                  }
                  className="min-h-10 rounded-md border border-line bg-panel px-3 text-sm"
                  aria-label={`${item.name} 선호도`}
                >
                  {userPreferences.map((preference) => (
                    <option key={preference} value={preference}>
                      {titleCase(preference)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => updateEquipment(item.id, { is_available: !item.is_available })}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${
                    item.is_available
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {item.is_available ? (
                    <Check size={16} aria-hidden />
                  ) : (
                    <X size={16} aria-hidden />
                  )}
                  {item.is_available ? "사용 가능" : "사용 불가"}
                </button>
              </div>

              {editing ? (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">
                      이름
                      <input
                        value={item.name}
                        onChange={(event) => updateEquipment(item.id, { name: event.target.value })}
                        className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      카테고리
                      <input
                        value={item.category}
                        onChange={(event) =>
                          updateEquipment(item.id, { category: event.target.value })
                        }
                        className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      브랜드
                      <input
                        value={item.brand}
                        onChange={(event) => updateEquipment(item.id, { brand: event.target.value })}
                        className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      모델
                      <input
                        value={item.model}
                        onChange={(event) => updateEquipment(item.id, { model: event.target.value })}
                        className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      기구 타입
                      <select
                        value={item.equipment_type}
                        onChange={(event) =>
                          updateEquipment(item.id, {
                            equipment_type: event.target.value as Equipment["equipment_type"]
                          })
                        }
                        className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                      >
                        {equipmentTypes.map((type) => (
                          <option key={type} value={type}>
                            {titleCase(type)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      로딩 타입
                      <select
                        value={item.load_type}
                        onChange={(event) =>
                          updateEquipment(item.id, {
                            load_type: event.target.value as Equipment["load_type"]
                          })
                        }
                        className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                      >
                        {loadTypes.map((type) => (
                          <option key={type} value={type}>
                            {titleCase(type)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block text-xs font-medium text-slate-600">
                    움직임 패턴
                    <input
                      value={item.movement_patterns.join(", ")}
                      onChange={(event) =>
                        updateEquipment(item.id, {
                          movement_patterns: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                        })
                      }
                      className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">
                    <TagEditor
                      label="주동근"
                      options={muscles}
                      values={item.primary_muscles}
                      onChange={(value) =>
                        updateEquipment(item.id, {
                          primary_muscles: toggleValue(item.primary_muscles, value)
                        })
                      }
                    />
                    <TagEditor
                      label="타깃 부위"
                      options={targetRegions}
                      values={item.target_regions}
                      onChange={(value) =>
                        updateEquipment(item.id, {
                          target_regions: toggleValue(item.target_regions, value)
                        })
                      }
                    />
                    <TagEditor
                      label="움직임 계열"
                      options={movementFamilies}
                      values={item.movement_family}
                      onChange={(value) =>
                        updateEquipment(item.id, {
                          movement_family: toggleValue(item.movement_family, value)
                        })
                      }
                    />
                  </div>

                  <label className="block text-xs font-medium text-slate-600">
                    메모
                    <textarea
                      value={item.notes}
                      onChange={(event) => updateEquipment(item.id, { notes: event.target.value })}
                      className="mt-1 min-h-20 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
                    />
                  </label>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function TagEditor<T extends string>({
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
    <fieldset className="min-w-0">
      <legend className="text-xs font-semibold text-slate-600">{label}</legend>
      <div className="scrollbar-thin mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
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

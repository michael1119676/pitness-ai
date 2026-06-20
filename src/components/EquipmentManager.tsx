"use client";

import Link from "next/link";
import { Check, Edit3, Plus, RotateCcw, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { equipmentCatalog } from "@/lib/equipment-data";
import { compactList, titleCase } from "@/lib/format";
import { loadEquipment, resetEquipment, saveEquipment } from "@/lib/local-store";
import {
  equipmentTypes,
  muscles,
  type Equipment,
  type Muscle
} from "@/lib/types";

type Filters = {
  query: string;
  muscle: "all" | Muscle;
  availableOnly: boolean;
  preferredOnly: boolean;
};

const initialFilters: Filters = {
  query: "",
  muscle: "all",
  availableOnly: false,
  preferredOnly: false
};

export function EquipmentManager() {
  const [equipment, setEquipment] = useState<Equipment[]>(equipmentCatalog);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

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
        ...item.target_regions
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
      if (filters.availableOnly && !item.is_available) return false;
      if (filters.preferredOnly && item.user_preference !== "preferred") return false;
      return true;
    });
  }, [equipment, filters]);

  const counts = useMemo(
    () => ({
      total: equipment.length,
      available: equipment.filter((item) => item.is_available).length,
      preferred: equipment.filter((item) => item.user_preference === "preferred").length
    }),
    [equipment]
  );

  return (
    <div className="space-y-4">
      <section className="rounded-md bg-ink p-5 text-white shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">내 헬스장 기구</p>
        <h1 className="mt-2 text-2xl font-semibold">운동 추천에 쓸 기구만 켜두세요</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <DarkMini label="전체" value={`${counts.total}`} />
          <DarkMini label="사용 가능" value={`${counts.available}`} />
          <DarkMini label="선호" value={`${counts.preferred}`} />
        </div>
      </section>

      <section className="sticky top-[73px] z-20 rounded-md border border-line bg-white p-3 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal size={17} aria-hidden />
          빠른 필터
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">기구 검색</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            className="min-h-11 w-full rounded-md border border-line bg-panel pl-10 pr-3 text-sm"
            placeholder="기구 이름, 부위 검색"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <ToggleChip selected={filters.muscle === "all"} label="전체 부위" onClick={() => setFilters({ ...filters, muscle: "all" })} />
          {muscles
            .filter((muscle) => muscle !== "cardio")
            .slice(0, 14)
            .map((muscle) => (
              <ToggleChip
                key={muscle}
                selected={filters.muscle === muscle}
                label={titleCase(muscle)}
                onClick={() => setFilters({ ...filters, muscle })}
              />
            ))}
        </div>
        <div className="mt-2 flex gap-2">
          <ToggleChip
            selected={filters.availableOnly}
            label="사용 가능만"
            onClick={() => setFilters({ ...filters, availableOnly: !filters.availableOnly })}
          />
          <ToggleChip
            selected={filters.preferredOnly}
            label="선호만"
            onClick={() => setFilters({ ...filters, preferredOnly: !filters.preferredOnly })}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Link href="/equipment/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white">
          <Plus size={17} aria-hidden />
          기구 추가
        </Link>
      </div>

      <section className="grid gap-2">
        {filteredEquipment.map((item) => {
          const editing = editingId === item.id;
          return (
            <article key={item.id} className="rounded-md border border-line bg-white p-3 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{item.name}</h2>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {compactList(item.primary_muscles)} · {titleCase(item.equipment_type)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateEquipment(item.id, {
                        user_preference: item.user_preference === "preferred" ? "neutral" : "preferred"
                      })
                    }
                    className={`grid size-11 place-items-center rounded-md ${item.user_preference === "preferred" ? "bg-amber-50 text-amber-600" : "bg-panel text-slate-400"}`}
                    aria-label={`${item.name} 선호 기구 토글`}
                  >
                    <Star size={18} fill={item.user_preference === "preferred" ? "currentColor" : "none"} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateEquipment(item.id, { is_available: !item.is_available })}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${
                      item.is_available ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {item.is_available ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
                    {item.is_available ? "가능" : "불가"}
                  </button>
                </div>
              </div>

              <details className="mt-2">
                <summary className="flex min-h-10 cursor-pointer items-center justify-between rounded-md bg-panel px-3 text-sm font-semibold text-slate-600">
                  세부 정보
                  <Edit3 size={15} aria-hidden />
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-panel px-2 py-1 font-medium">{titleCase(item.load_type)}</span>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">{compactList(item.primary_muscles)}</span>
                    <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700">{compactList(item.target_regions)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(editing ? null : item.id)}
                    className="min-h-10 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700"
                  >
                    편집
                  </button>
                  {editing ? (
                    <div className="grid gap-3 border-t border-line pt-3 md:grid-cols-2">
                      <TextEdit label="이름" value={item.name} onChange={(name) => updateEquipment(item.id, { name })} />
                      <TextEdit label="카테고리" value={item.category} onChange={(category) => updateEquipment(item.id, { category })} />
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
                            <option key={type} value={type}>{titleCase(type)}</option>
                          ))}
                        </select>
                      </label>
                      <TextEdit label="메모" value={item.notes} onChange={(notes) => updateEquipment(item.id, { notes })} />
                    </div>
                  ) : null}
                </div>
              </details>
            </article>
          );
        })}
      </section>

      <section className="rounded-md border border-rose-100 bg-white p-4 shadow-soft">
        <h2 className="font-semibold text-rose-800">위험 영역</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          전체 초기화는 모든 기구 선호도와 사용 가능 상태를 기본값으로 되돌립니다.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700"
          >
            <RotateCcw size={17} aria-hidden />
            전체 초기화
          </button>
          {confirmReset ? (
            <button
              type="button"
              onClick={() => {
                persist(resetEquipment());
                setConfirmReset(false);
              }}
              className="min-h-11 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white"
            >
              정말 초기화
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ToggleChip({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-md border px-3 text-sm font-semibold ${
        selected ? "border-ink bg-ink text-white" : "border-line bg-panel text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}

function TextEdit({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
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

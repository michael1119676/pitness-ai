"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { equipmentCatalog } from "@/lib/equipment-data";
import { exerciseCatalog } from "@/lib/exercise-data";
import { compactList, titleCase } from "@/lib/format";
import { loadEquipment, loadSettings } from "@/lib/local-store";
import { filterAvailableExercises, getEquipmentForExercise } from "@/lib/workout-engine";
import {
  emptyWorkoutInput,
  movementFamilies,
  muscles,
  type Equipment,
  type MovementFamily,
  type Muscle
} from "@/lib/types";

export function ExerciseExplorer() {
  const [equipment, setEquipment] = useState<Equipment[]>(equipmentCatalog);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<"all" | Muscle>("all");
  const [family, setFamily] = useState<"all" | MovementFamily>("all");
  const [availableOnly, setAvailableOnly] = useState(true);

  useEffect(() => {
    setEquipment(loadEquipment());
  }, []);

  const availableExerciseIds = useMemo(() => {
    const settings = loadSettings();
    const input = {
      ...emptyWorkoutInput,
      equipmentPreference: settings.defaultEquipmentPreference,
      soreMuscles: settings.soreMuscles
    };
    return new Set(
      filterAvailableExercises(exerciseCatalog, equipment, input).map((exercise) => exercise.id)
    );
  }, [equipment]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return exerciseCatalog.filter((exercise) => {
      const requiredEquipment = getEquipmentForExercise(exercise, equipment);
      const haystack = [
        exercise.name,
        exercise.primary_muscle,
        exercise.target_region,
        exercise.movement_pattern,
        exercise.movement_family,
        ...exercise.secondary_muscles,
        ...requiredEquipment.map((item) => item.name)
      ]
        .join(" ")
        .toLowerCase();

      if (search && !haystack.includes(search)) return false;
      if (
        muscle !== "all" &&
        exercise.primary_muscle !== muscle &&
        !exercise.secondary_muscles.includes(muscle)
      ) {
        return false;
      }
      if (family !== "all" && exercise.movement_family !== family) return false;
      if (availableOnly && !availableExerciseIds.has(exercise.id)) return false;
      return true;
    });
  }, [availableExerciseIds, equipment, family, muscle, query, availableOnly]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">운동</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">기구와 연결된 운동</h1>
        <p className="mt-2 text-sm text-slate-600">
          전체 운동 {exerciseCatalog.length}개 중 현재 가능한 운동 {availableExerciseIds.size}개.
        </p>
      </div>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2">
            <span className="sr-only">운동 검색</span>
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 w-full rounded-md border border-line bg-panel pl-10 pr-3 text-sm"
              placeholder="운동, 기구, 움직임 검색"
            />
          </label>
          <select
            value={muscle}
            onChange={(event) => setMuscle(event.target.value as "all" | Muscle)}
            className="min-h-11 rounded-md border border-line bg-panel px-3 text-sm"
            aria-label="근육별 필터"
          >
            <option value="all">전체 근육</option>
            {muscles.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>
          <select
            value={family}
            onChange={(event) => setFamily(event.target.value as "all" | MovementFamily)}
            className="min-h-11 rounded-md border border-line bg-panel px-3 text-sm"
            aria-label="움직임 계열별 필터"
          >
            <option value="all">전체 움직임 계열</option>
            {movementFamilies.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>
        </div>
        <label className="mt-3 flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
            className="size-4 accent-mint"
          />
          등록된 기구로 가능한 운동만 보기
        </label>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {filtered.map((exercise) => {
          const requiredEquipment = getEquipmentForExercise(exercise, equipment);
          const available = availableExerciseIds.has(exercise.id);
          return (
            <article key={exercise.id} className="rounded-md border border-line bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{exercise.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {titleCase(exercise.primary_muscle)} / {titleCase(exercise.target_region)}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    available ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-coral"
                  }`}
                >
                  {available ? "가능" : "제외됨"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-panel px-2 py-1 font-medium">
                  {titleCase(exercise.movement_family)}
                </span>
                <span className="rounded-md bg-panel px-2 py-1 font-medium">
                  {titleCase(exercise.movement_pattern)}
                </span>
                <span className="rounded-md bg-panel px-2 py-1 font-medium">
                  {exercise.default_sets} x {exercise.default_rep_min}-{exercise.default_rep_max}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                기구: {compactList(requiredEquipment.map((item) => item.name), 2)}
              </p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

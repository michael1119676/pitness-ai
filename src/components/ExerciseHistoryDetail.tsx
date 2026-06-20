"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { exerciseCatalog } from "@/lib/exercise-data";
import { getLocalDateKey } from "@/lib/date";
import { loadWorkoutSetRecords, migrateWorkoutLogsToSessionRecords } from "@/lib/local-store";
import { formatBodyPart } from "@/lib/daily-planning";
import { formatDateShort, formatNumber } from "@/lib/mobile-ui";
import type { WorkoutSetRecord } from "@/lib/daily-types";

function estimatedOneRepMax(weightKg: number | null, reps: number | null) {
  if (!weightKg || !reps) return null;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function ExerciseHistoryDetail({ exerciseId }: { exerciseId: string }) {
  const [sets, setSets] = useState<WorkoutSetRecord[]>([]);
  const exercise = useMemo(() => exerciseCatalog.find((item) => item.id === exerciseId) ?? null, [exerciseId]);

  useEffect(() => {
    migrateWorkoutLogsToSessionRecords();
    setSets(loadWorkoutSetRecords().filter((set) => set.exerciseId === exerciseId && set.wasCompleted));
  }, [exerciseId]);

  const stats = useMemo(() => {
    const workingSets = sets.filter((set) => set.setType === "working");
    const bestWeight = Math.max(0, ...workingSets.map((set) => set.actualWeightKg ?? 0));
    const bestReps = Math.max(0, ...workingSets.map((set) => set.actualReps ?? 0));
    const totalVolume = workingSets.reduce((sum, set) => sum + (set.actualWeightKg ?? 0) * (set.actualReps ?? 0), 0);
    const bestE1rm = Math.max(0, ...workingSets.map((set) => estimatedOneRepMax(set.actualWeightKg, set.actualReps) ?? 0));
    const byDay = new Map<string, number>();
    workingSets.forEach((set) => {
      if (!set.completedAt) return;
      const day = getLocalDateKey(new Date(set.completedAt));
      byDay.set(day, (byDay.get(day) ?? 0) + (set.actualWeightKg ?? 0) * (set.actualReps ?? 0));
    });
    return {
      bestWeight,
      bestReps,
      totalVolume: Math.round(totalVolume * 10) / 10,
      bestE1rm,
      byDay: Array.from(byDay.entries()).slice(-8)
    };
  }, [sets]);

  return (
    <div className="space-y-4">
      <Link href="/records" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-panel px-3 text-sm font-semibold">
        <ArrowLeft size={16} aria-hidden /> 기록으로
      </Link>

      <section className="rounded-md bg-ink p-5 text-white shadow-soft">
        <p className="text-xs font-semibold text-mint">운동 히스토리</p>
        <h1 className="mt-2 text-2xl font-semibold">{exercise?.name ?? exerciseId}</h1>
        {exercise ? <p className="mt-2 text-sm text-slate-300">{formatBodyPart(exercise.primary_muscle)} · {formatBodyPart(exercise.target_region)}</p> : null}
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Metric label="최고 중량" value={formatNumber(stats.bestWeight, "kg")} />
        <Metric label="최고 반복" value={`${stats.bestReps}회`} />
        <Metric label="추정 1RM" value={formatNumber(stats.bestE1rm, "kg")} />
        <Metric label="총 볼륨" value={formatNumber(stats.totalVolume, "kg")} />
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <h2 className="font-semibold">최근 볼륨 추세</h2>
        <div className="mt-4 space-y-2">
          {stats.byDay.length > 0 ? stats.byDay.map(([day, volume]) => (
            <div key={day}>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{formatDateShort(day)}</span>
                <span>{formatNumber(volume, "kg")}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-panel">
                <div className="h-2 rounded-full bg-mint" style={{ width: `${Math.min(100, volume / Math.max(1, stats.totalVolume) * 100)}%` }} />
              </div>
            </div>
          )) : <p className="text-sm text-slate-500">아직 완료된 세트가 없습니다.</p>}
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <h2 className="font-semibold">최근 세트</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2">날짜</th>
                <th>구분</th>
                <th>중량</th>
                <th>반복</th>
                <th>RIR/RPE</th>
              </tr>
            </thead>
            <tbody>
              {sets.slice().reverse().slice(0, 20).map((set) => (
                <tr key={set.id} className="border-t border-line">
                  <td className="py-2">{formatDateShort(set.completedAt)}</td>
                  <td>{set.setType === "warmup" ? "워밍업" : "본세트"}</td>
                  <td>{formatNumber(set.actualWeightKg, "kg")}</td>
                  <td>{set.actualReps ?? "-"}</td>
                  <td>{set.rir ?? "-"} / {set.rpe ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white px-3 py-3 shadow-soft">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

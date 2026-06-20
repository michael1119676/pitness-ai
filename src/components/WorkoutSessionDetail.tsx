"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { exerciseCatalog } from "@/lib/exercise-data";
import {
  loadWorkoutSessionExerciseRecords,
  loadWorkoutSessionRecords,
  loadWorkoutSetRecords,
  migrateWorkoutLogsToSessionRecords,
  saveWorkoutSetRecords
} from "@/lib/local-store";
import { formatBodyPart } from "@/lib/daily-planning";
import { formatDateShort, formatNumber } from "@/lib/mobile-ui";
import type { WorkoutSessionExerciseRecord, WorkoutSessionRecord, WorkoutSetRecord } from "@/lib/daily-types";

export function WorkoutSessionDetail({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<WorkoutSessionRecord | null>(null);
  const [sessionExercises, setSessionExercises] = useState<WorkoutSessionExerciseRecord[]>([]);
  const [sets, setSets] = useState<WorkoutSetRecord[]>([]);

  useEffect(() => {
    migrateWorkoutLogsToSessionRecords();
    setSession(loadWorkoutSessionRecords().find((item) => item.id === sessionId) ?? null);
    setSessionExercises(loadWorkoutSessionExerciseRecords().filter((item) => item.sessionId === sessionId));
    setSets(loadWorkoutSetRecords().filter((item) => item.sessionId === sessionId));
  }, [sessionId]);

  const exercises = useMemo(() => new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise])), []);

  function toggleSet(set: WorkoutSetRecord) {
    const all = loadWorkoutSetRecords();
    const nextAll = all.map((item) =>
      item.id === set.id
        ? {
          ...item,
          wasCompleted: !item.wasCompleted,
          completedAt: item.wasCompleted ? null : new Date().toISOString()
        }
        : item
    );
    saveWorkoutSetRecords(nextAll);
    setSets(nextAll.filter((item) => item.sessionId === sessionId));
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Link href="/records" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-panel px-3 text-sm font-semibold">
          <ArrowLeft size={16} aria-hidden /> 기록으로
        </Link>
        <p className="rounded-md bg-white p-4 text-sm text-slate-600 shadow-soft">세션 기록을 찾지 못했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/records" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-panel px-3 text-sm font-semibold">
        <ArrowLeft size={16} aria-hidden /> 기록으로
      </Link>

      <section className="rounded-md bg-ink p-5 text-white shadow-soft">
        <p className="text-xs font-semibold text-mint">{formatDateShort(session.localDate)}</p>
        <h1 className="mt-2 text-2xl font-semibold">{session.sessionTitle}</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Mini label="본세트" value={`${session.completedWorkingSets}/${session.totalWorkingSets}`} />
          <Mini label="볼륨" value={formatNumber(session.totalVolumeKg, "kg")} />
          <Mini label="상태" value={session.status === "completed" ? "완료" : session.status === "in_progress" ? "진행 중" : "중단"} />
        </div>
      </section>

      <section className="space-y-3">
        {sessionExercises.sort((a, b) => a.order - b.order).map((sessionExercise) => {
          const exercise = exercises.get(sessionExercise.exerciseId);
          const exerciseSets = sets.filter((set) => set.sessionExerciseId === sessionExercise.id);
          return (
            <article key={sessionExercise.id} className="rounded-md border border-line bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{exercise?.name ?? sessionExercise.exerciseId}</h2>
                  {exercise ? <p className="mt-1 text-xs text-slate-500">{formatBodyPart(exercise.primary_muscle)} · {formatBodyPart(exercise.target_region)}</p> : null}
                </div>
                <Link href={`/exercises/${sessionExercise.exerciseId}/history`} className="min-h-10 rounded-md bg-panel px-3 text-xs font-semibold leading-10">
                  히스토리
                </Link>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2">세트</th>
                      <th>구분</th>
                      <th>목표</th>
                      <th>실제</th>
                      <th>RIR/RPE</th>
                      <th>완료</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exerciseSets.map((set) => (
                      <tr key={set.id} className="border-t border-line">
                        <td className="py-2">{set.setIndex}</td>
                        <td>{set.setType === "warmup" ? "워밍업" : "본세트"}</td>
                        <td>{formatNumber(set.targetWeightKg, "kg")} · {set.targetReps ?? "-"}회</td>
                        <td>{formatNumber(set.actualWeightKg, "kg")} · {set.actualReps ?? "-"}회</td>
                        <td>{set.rir ?? "-"} / {set.rpe ?? "-"}</td>
                        <td>
                          <button type="button" onClick={() => toggleSet(set)} className="min-h-10 rounded-md bg-panel px-3 text-xs font-semibold">
                            {set.wasCompleted ? "완료" : "미완료"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/10 px-3 py-2">
      <p className="text-[11px] font-semibold opacity-70">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

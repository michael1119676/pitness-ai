"use client";

import Link from "next/link";
import { Activity, ArrowRight, Dumbbell, Goal, Library, Scale, Settings, Utensils, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { exerciseCatalog } from "@/lib/exercise-data";
import { getInBodyTrendSummary } from "@/lib/inbody";
import {
  loadAllMealLogs,
  loadBodyCompositions,
  loadWorkoutLogs,
  todayKey
} from "@/lib/local-store";
import { formatBodyPart } from "@/lib/daily-planning";
import { formatDateShort, formatNumber } from "@/lib/mobile-ui";
import type { MealLog, WorkoutSetLog } from "@/lib/daily-types";

function startOfWeek() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function sameDay(value: string, date = todayKey()) {
  return value.startsWith(date);
}

export function RecordsDashboard() {
  const [logs, setLogs] = useState<WorkoutSetLog[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [bodyRecords, setBodyRecords] = useState(loadBodyCompositions);

  useEffect(() => {
    setLogs(loadWorkoutLogs());
    setMeals(loadAllMealLogs());
    setBodyRecords(loadBodyCompositions());
  }, []);

  const recentWorkoutDays = useMemo(() => {
    const days = new Map<string, WorkoutSetLog[]>();
    logs
      .filter((log) => log.wasCompleted)
      .slice()
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
      .forEach((log) => {
        const day = log.performedAt.slice(0, 10);
        days.set(day, [...(days.get(day) ?? []), log]);
      });
    return Array.from(days.entries()).slice(0, 4);
  }, [logs]);

  const weeklyVolume = useMemo(() => {
    const start = startOfWeek().toISOString();
    const exercises = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]));
    const volume = new Map<string, number>();
    logs
      .filter((log) => log.wasCompleted && log.performedAt >= start)
      .forEach((log) => {
        const exercise = exercises.get(log.exerciseId);
        if (!exercise) return;
        volume.set(exercise.primary_muscle, (volume.get(exercise.primary_muscle) ?? 0) + 1);
      });
    return Array.from(volume.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [logs]);

  const bodyTrend = useMemo(() => getInBodyTrendSummary(bodyRecords), [bodyRecords]);
  const todayMeals = meals.filter((meal) => sameDay(meal.loggedAt));
  const avgCalories =
    meals.length === 0
      ? 0
      : Math.round(meals.reduce((sum, meal) => sum + meal.calories, 0) / Math.max(1, new Set(meals.map((meal) => meal.loggedAt.slice(0, 10))).size));

  return (
    <div className="space-y-4">
      <section className="rounded-md bg-ink p-5 text-white shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">기록</p>
        <h1 className="mt-2 text-2xl font-semibold">몸이 어떻게 반응하는지 보기</h1>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Mini label="오늘 식사" value={`${todayMeals.length}개`} />
          <Mini label="운동 세트" value={`${logs.filter((log) => log.wasCompleted).length}세트`} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Panel title="최근 운동" icon={Dumbbell} actionHref="/workout">
          {recentWorkoutDays.length > 0 ? (
            <div className="space-y-2">
              {recentWorkoutDays.map(([day, dayLogs]) => (
                <div key={day} className="rounded-md bg-panel px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{formatDateShort(day)}</span>
                    <span className="text-slate-500">{dayLogs.length}세트</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="아직 저장된 운동이 없습니다. 오늘 루틴을 시작해 첫 기록을 남겨보세요." href="/today" cta="오늘 운동 보기" />
          )}
        </Panel>

        <Panel title="주간 부위별 운동량" icon={Activity}>
          {weeklyVolume.length > 0 ? (
            <div className="space-y-3">
              {weeklyVolume.map(([muscle, count]) => (
                <div key={muscle}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{formatBodyPart(muscle)}</span>
                    <span className="font-semibold">{count}세트</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-panel">
                    <div className="h-2 rounded-full bg-mint" style={{ width: `${Math.min(100, count * 12)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="이번 주 부위별 기록이 아직 없습니다." href="/workout" cta="운동 시작" />
          )}
        </Panel>

        <Panel title="인바디 추세" icon={Scale} actionHref="/body">
          {bodyTrend.latest && bodyTrend.recordCount >= 2 ? (
            <div className="grid grid-cols-3 gap-2">
              <Mini label="체중" value={formatNumber(bodyTrend.latest.weightKg, "kg")} light />
              <Mini label="골격근" value={formatNumber(bodyTrend.latest.skeletalMuscleMassKg, "kg")} light />
              <Mini label="체지방률" value={formatNumber(bodyTrend.latest.bodyFatPercentage, "%")} light />
            </div>
          ) : bodyTrend.latest ? (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-slate-600">
                최근 측정은 저장됐습니다. 한 번 더 기록하면 변화 추세를 보여드릴게요.
              </p>
              <Mini label="최근 측정" value={formatDateShort(bodyTrend.latest.measuredAt)} light />
            </div>
          ) : (
            <Empty text="아직 인바디 기록이 없습니다. CSV를 가져오면 체중, 골격근량, 체지방률 변화를 볼 수 있어요." href="/body/import" cta="인바디 CSV 가져오기" />
          )}
        </Panel>

        <Panel title="식단 평균" icon={Utensils} actionHref="/nutrition">
          {meals.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <Mini label="일평균 kcal" value={`${avgCalories}kcal`} light />
              <Mini label="오늘 기록" value={`${todayMeals.length}끼`} light />
            </div>
          ) : (
            <Empty text="아직 식사 기록이 없습니다. 최근 식사를 한 번 저장하면 다음부터 빠르게 재사용할 수 있어요." href="/nutrition" cta="식사 기록하기" />
          )}
        </Panel>
      </section>

      <section className="grid gap-2 md:grid-cols-3">
        <QuickLink href="/body" icon={Scale} label="인바디" />
        <QuickLink href="/equipment" icon={Wrench} label="내 헬스장 기구" />
        <QuickLink href="/exercises" icon={Library} label="운동 라이브러리" />
        <QuickLink href="/goals" icon={Goal} label="목표 체형" />
        <QuickLink href="/settings" icon={Settings} label="설정" />
      </section>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  actionHref,
  children
}: {
  title: string;
  icon: typeof Dumbbell;
  actionHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-mint" aria-hidden />
          <h2 className="font-semibold">{title}</h2>
        </div>
        {actionHref ? (
          <Link href={actionHref} className="grid size-9 place-items-center rounded-md bg-panel text-slate-600" aria-label={`${title} 열기`}>
            <ArrowRight size={16} aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Mini({ label, value, light = false }: { label: string; value: string; light?: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2 ${light ? "bg-panel text-ink" : "bg-white/10 text-white"}`}>
      <p className="text-[11px] font-semibold opacity-70">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="rounded-md bg-panel px-3 py-3">
      <p className="text-sm leading-6 text-slate-600">{text}</p>
      <Link href={href} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md bg-ink px-3 text-sm font-semibold text-white">
        {cta}
      </Link>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Activity; label: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700 shadow-soft">
      <Icon size={17} className="text-mint" aria-hidden />
      {label}
    </Link>
  );
}

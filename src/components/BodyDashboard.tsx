"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { BodyComposition } from "@/lib/daily-types";
import { getInBodyTrendSummary } from "@/lib/inbody";
import { loadBodyCompositions } from "@/lib/local-store";

function formatNumber(value: number | null | undefined, suffix = "") {
  return value === null || value === undefined ? "-" : `${Math.round(value * 10) / 10}${suffix}`;
}

export function BodyDashboard() {
  const [records, setRecords] = useState<BodyComposition[]>([]);

  useEffect(() => {
    setRecords(loadBodyCompositions());
  }, []);

  const trend = useMemo(() => getInBodyTrendSummary(records), [records]);
  const latest = trend.latest;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mint">인바디</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Body Composition</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            단일 기록으로 루틴을 크게 바꾸지 않고, 2~4주 추세와 운동 기록을 함께 봅니다.
          </p>
        </div>
        <Link
          href="/body/import"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
        >
          <Upload size={17} aria-hidden />
          CSV 가져오기
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="기록 수" value={`${trend.recordCount}개`} />
        <Metric label="신뢰도" value={trend.confidence} />
        <Metric label="상태" value={trend.status === "ok" ? "추세 사용" : "데이터 부족"} />
        <Metric label="최근 측정" value={latest?.measuredAt.slice(0, 10) ?? "-"} />
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <h2 className="text-lg font-semibold">최신 기록</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Metric label="체중" value={formatNumber(latest?.weightKg, " kg")} />
          <Metric label="골격근량" value={formatNumber(latest?.skeletalMuscleMassKg, " kg")} />
          <Metric label="체지방량" value={formatNumber(latest?.bodyFatMassKg, " kg")} />
          <Metric label="체지방률" value={formatNumber(latest?.bodyFatPercentage, "%")} />
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <h2 className="text-lg font-semibold">최근 변화와 4주 평균</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Info label="latest vs previous">
            체중 {formatNumber(trend.weightChangeKg, " kg")} / 골격근량{" "}
            {formatNumber(trend.skeletalMuscleMassChangeKg, " kg")} / 체지방량{" "}
            {formatNumber(trend.bodyFatMassChangeKg, " kg")} / 체지방률{" "}
            {formatNumber(trend.bodyFatPercentageChange, "%")}
          </Info>
          <Info label="최근 4주 평균">
            체중 {formatNumber(trend.fourWeekAverages.weightKg, " kg")} / 골격근량{" "}
            {formatNumber(trend.fourWeekAverages.skeletalMuscleMassKg, " kg")} / 체지방률{" "}
            {formatNumber(trend.fourWeekAverages.bodyFatPercentage, "%")}
          </Info>
          <Info label="좌우 밸런스">
            팔 차이 {formatNumber(trend.armMuscleImbalanceKg, " kg")} / 다리 차이{" "}
            {formatNumber(trend.legMuscleImbalanceKg, " kg")}
          </Info>
          <Info label="수분 지표">{trend.hydrationNote}</Info>
        </div>
        <div className="mt-4 space-y-2">
          {trend.summary.map((line) => (
            <p key={line} className="rounded-md bg-panel px-3 py-2 text-sm leading-6 text-slate-700">
              {line}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <h2 className="text-lg font-semibold">최근 기록</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2">날짜</th>
                <th>체중</th>
                <th>골격근량</th>
                <th>체지방량</th>
                <th>체지방률</th>
                <th>장비</th>
              </tr>
            </thead>
            <tbody>
              {records
                .slice()
                .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
                .slice(0, 12)
                .map((record) => (
                  <tr key={record.measuredAt} className="border-t border-line">
                    <td className="py-2">{record.measuredAt.slice(0, 16).replace("T", " ")}</td>
                    <td>{formatNumber(record.weightKg, " kg")}</td>
                    <td>{formatNumber(record.skeletalMuscleMassKg, " kg")}</td>
                    <td>{formatNumber(record.bodyFatMassKg, " kg")}</td>
                    <td>{formatNumber(record.bodyFatPercentage, "%")}</td>
                    <td>{record.device ?? "-"}</td>
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
    <div className="rounded-md border border-line bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md bg-panel px-3 py-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{children}</p>
    </div>
  );
}

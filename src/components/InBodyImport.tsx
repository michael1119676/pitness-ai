"use client";

import Link from "next/link";
import { ArrowLeft, FileUp } from "lucide-react";
import { useState } from "react";
import { buildDailyPlanSnapshot, loadDailyPlanningState } from "@/lib/daily-plan-client";
import { parseInBodyCsv, upsertBodyCompositions } from "@/lib/inbody";
import {
  appendDailyPlanRevision,
  loadBodyCompositions,
  saveBodyCompositions
} from "@/lib/local-store";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function InBodyImport() {
  const [status, setStatus] = useState<{
    inserted: number;
    duplicate: number;
    failed: number;
    failedRows: number[];
  } | null>(null);
  const [message, setMessage] = useState("");

  async function importFile(file: File) {
    setMessage("");
    const text = await file.text();
    const parsed = parseInBodyCsv(text);
    const result = upsertBodyCompositions(loadBodyCompositions(), parsed.records);
    saveBodyCompositions(result.records);

    const state = loadDailyPlanningState();
    const snapshot = buildDailyPlanSnapshot({
      ...state,
      bodyCompositions: result.records
    });
    appendDailyPlanRevision({
      id: makeId("revision"),
      date: state.date,
      triggerType: "inbody_csv_uploaded",
      triggerPayload: {
        fileName: file.name,
        inserted: result.inserted,
        duplicate: result.duplicate,
        failedRows: parsed.failedRows
      },
      trainingDecisionSnapshot: snapshot.decision,
      finalWorkoutPlanSnapshot: snapshot.plan,
      nutritionPlanSnapshot: snapshot.nutritionPlan,
      createdAt: new Date().toISOString()
    });

    setStatus({
      inserted: result.inserted,
      duplicate: result.duplicate,
      failed: parsed.failedRows.length,
      failedRows: parsed.failedRows
    });
    setMessage("CSV 가져오기를 완료했습니다.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mint">인바디 CSV</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">CSV 가져오기</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            UTF-8 BOM, `-` null, 0 값, 여러 행, 같은 측정시간 중복을 처리합니다.
          </p>
        </div>
        <Link
          href="/body"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-slate-700"
        >
          <ArrowLeft size={17} aria-hidden />
          인바디로 돌아가기
        </Link>
      </div>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-line bg-panel px-4 text-center">
          <FileUp size={28} className="text-mint" aria-hidden />
          <span className="mt-3 text-sm font-semibold text-ink">CSV 파일 선택</span>
          <span className="mt-1 text-xs text-slate-500">InBody export CSV를 업로드하세요.</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void importFile(file);
              }
            }}
          />
        </label>
      </section>

      {message ? (
        <p className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-soft">
          {message}
        </p>
      ) : null}

      {status ? (
        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="성공" value={`${status.inserted}행`} />
          <Metric label="중복" value={`${status.duplicate}행`} />
          <Metric label="실패" value={`${status.failed}행`} />
          <Metric
            label="실패 행"
            value={status.failedRows.length > 0 ? status.failedRows.join(", ") : "-"}
          />
        </section>
      ) : null}
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

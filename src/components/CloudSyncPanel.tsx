"use client";

import { Cloud, DownloadCloud, RefreshCcw, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ensureCloudSession,
  getCloudSyncStatus,
  pullCloudSnapshotToLocal,
  pushLocalSnapshotToCloud,
  type CloudSyncStatus
} from "@/lib/cloud-sync";

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function shortId(value: string | null) {
  if (!value) return "-";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function CloudSyncPanel() {
  const [status, setStatus] = useState<CloudSyncStatus>({
    configured: false,
    lastPushAt: null,
    lastPullAt: null,
    lastError: null,
    userId: null,
    profileId: null,
    profileName: null
  });
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");

  function refresh() {
    setStatus(getCloudSyncStatus());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function run(label: string, action: () => Promise<unknown>, reloadAfter = false) {
    setIsBusy(true);
    setMessage("");
    try {
      await action();
      refresh();
      setMessage(label);
      if (reloadAfter) {
        window.location.reload();
      }
    } catch (error) {
      refresh();
      setMessage(error instanceof Error ? error.message : "클라우드 동기화 중 오류가 발생했습니다.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cloud size={18} className="text-mint" aria-hidden />
            <h2 className="text-lg font-semibold">Supabase 클라우드 동기화</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            로그인한 Supabase 계정 기준으로 현재 앱 상태를 snapshot으로 저장합니다.
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            status.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {status.configured ? "환경변수 연결됨" : "환경변수 필요"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-5">
        <Metric label="앱 계정" value={status.profileName ?? "-"} />
        <Metric label="Supabase" value={shortId(status.userId)} />
        <Metric label="마지막 업로드" value={formatTime(status.lastPushAt)} />
        <Metric label="마지막 복원" value={formatTime(status.lastPullAt)} />
        <Metric label="마지막 오류" value={status.lastError ?? "-"} />
      </div>

      {!status.configured ? (
        <div className="mt-4 rounded-md bg-panel px-3 py-3 text-sm leading-6 text-slate-700">
          `.env.local`과 Vercel 환경변수에 `NEXT_PUBLIC_SUPABASE_URL`,
          `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 추가하세요. Supabase Auth에서 Email provider를
          켜야 계정 로그인과 동기화를 사용할 수 있습니다.
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => run("Supabase 세션을 확인했습니다.", ensureCloudSession)}
          disabled={!status.configured || isBusy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <RefreshCcw size={16} aria-hidden />
          세션 확인
        </button>
        <button
          type="button"
          onClick={() => run("현재 앱 상태를 Supabase에 업로드했습니다.", pushLocalSnapshotToCloud)}
          disabled={!status.configured || isBusy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <UploadCloud size={16} aria-hidden />
          클라우드에 업로드
        </button>
        <button
          type="button"
          onClick={() =>
            run("Supabase에 저장된 앱 상태를 복원했습니다.", pullCloudSnapshotToLocal, true)
          }
          disabled={!status.configured || isBusy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <DownloadCloud size={16} aria-hidden />
          클라우드에서 복원
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

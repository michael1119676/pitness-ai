"use client";

import { LogIn, Plus, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAppUser,
  getActiveAppUser,
  getUserInitial,
  loadAppUsers,
  maxAppUsers,
  setActiveAppUser,
  type AppUser
} from "@/lib/app-users";

const accentClassNames: Record<string, string> = {
  mint: "bg-mint text-white",
  sky: "bg-sky-600 text-white",
  coral: "bg-rose-500 text-white"
};

export function LoginScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const canCreate = users.length < maxAppUsers;
  const slotsLabel = useMemo(() => `${users.length}/${maxAppUsers}`, [users.length]);

  function refresh() {
    setUsers(loadAppUsers());
    setActiveUserId(getActiveAppUser()?.id ?? null);
  }

  useEffect(() => {
    refresh();
  }, []);

  function enter(userId: string) {
    const user = setActiveAppUser(userId);
    if (!user) {
      setMessage("프로필을 찾지 못했습니다.");
      refresh();
      return;
    }
    router.replace("/today");
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const user = createAppUser(name);
      if (!user) return;
      setName("");
      router.replace("/today");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로필을 만들지 못했습니다.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-8 text-ink">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-mint">Pitness AI</p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">누가 운동하나요?</h1>
      </div>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">프로필</h2>
          <span className="rounded-md bg-panel px-2 py-1 text-xs font-semibold text-slate-600">
            {slotsLabel}
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => enter(user.id)}
              className={`flex min-h-16 items-center justify-between gap-3 rounded-md border px-3 text-left transition ${
                activeUserId === user.id
                  ? "border-ink bg-panel"
                  : "border-line bg-white hover:bg-panel"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-md text-sm font-bold ${
                    accentClassNames[user.accent] ?? accentClassNames.mint
                  }`}
                >
                  {getUserInitial(user.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{user.name}</span>
                  <span className="block text-xs text-slate-500">
                    {activeUserId === user.id ? "현재 선택됨" : "선택"}
                  </span>
                </span>
              </span>
              <LogIn size={18} aria-hidden />
            </button>
          ))}

          {users.length === 0 ? (
            <div className="rounded-md bg-panel px-3 py-4 text-sm font-medium text-slate-600">
              첫 프로필을 만들면 기존 기기 데이터가 자동으로 연결됩니다.
            </div>
          ) : null}
        </div>

        <form onSubmit={create} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="profile-name">
            프로필 이름
          </label>
          <div className="relative min-w-0 flex-1">
            <UserRound
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={canCreate ? "이름" : "프로필 최대 개수"}
              disabled={!canCreate}
              className="min-h-11 w-full rounded-md border border-line bg-white pl-10 pr-3 text-sm font-medium disabled:bg-panel"
            />
          </div>
          <button
            type="submit"
            disabled={!canCreate}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus size={17} aria-hidden />
            추가
          </button>
        </form>

        {message ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

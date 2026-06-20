"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Dumbbell,
  Activity,
  ListChecks,
  Menu,
  Settings,
  Sparkles,
  Utensils,
  Wrench
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  activateGuestAppUser,
  appUserChangeEvent,
  getActiveAppUser,
  getUserInitial,
  isGuestAppUser,
  type AppUser
} from "@/lib/app-users";

const navItems = [
  { href: "/today", label: "오늘", icon: CalendarDays },
  { href: "/workout", label: "운동", icon: Dumbbell },
  { href: "/nutrition", label: "식단", icon: Utensils },
  { href: "/records", label: "기록", icon: Activity }
];

const utilityLinks = [
  { href: "/records", label: "운동 기록", icon: Activity },
  { href: "/body", label: "인바디", icon: Activity },
  { href: "/equipment", label: "내 헬스장 기구", icon: Wrench },
  { href: "/exercises", label: "운동 라이브러리", icon: ListChecks },
  { href: "/goals", label: "목표 체형", icon: Sparkles },
  { href: "/settings", label: "설정", icon: Settings }
];

function pageTitle(pathname: string) {
  if (pathname.startsWith("/workout")) return "운동";
  if (pathname.startsWith("/nutrition") || pathname.startsWith("/meals")) return "식단";
  if (pathname.startsWith("/records")) return "기록";
  if (pathname.startsWith("/body")) return "인바디";
  if (pathname.startsWith("/equipment")) return "내 헬스장 기구";
  if (pathname.startsWith("/exercises")) return "운동 라이브러리";
  if (pathname.startsWith("/goals") || pathname.startsWith("/settings/goals")) return "목표 체형";
  if (pathname.startsWith("/settings")) return "설정";
  return "오늘";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeUser, setActiveUser] = useState<AppUser | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    const startVisitor = () => {
      const visitor = activateGuestAppUser();
      if (isMounted) setActiveUser(visitor);
    };

    const refresh = async () => {
      const localUser = getActiveAppUser();
      if (localUser) {
        if (isMounted) setActiveUser(localUser);
        return;
      }

      startVisitor();
    };

    void refresh();
    const handleUserChange = () => {
      void refresh();
    };
    window.addEventListener("storage", handleUserChange);
    window.addEventListener(appUserChangeEvent, handleUserChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleUserChange);
      window.removeEventListener(appUserChangeEvent, handleUserChange);
    };
  }, []);

  if (activeUser === undefined) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-sm font-semibold text-slate-500">
        화면 준비 중
      </div>
    );
  }

  if (!activeUser) {
    return null;
  }

  return (
    <div className="min-h-screen pb-[calc(5.75rem+env(safe-area-inset-bottom))] text-ink md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-panel/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/today" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink text-white">
              <Sparkles size={20} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold md:text-base">
                <span className="md:hidden">{pageTitle(pathname)}</span>
                <span className="hidden md:inline">어댑티브 데일리 피트니스 코치</span>
              </span>
              <span className="block truncate text-xs text-slate-500">
                등록 기구 기반 맞춤 루틴
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-ink text-white"
                      : "text-slate-600 hover:bg-white hover:text-ink"
                  }`}
                >
                  <Icon size={17} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0">
            <details className="group relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700 shadow-soft marker:hidden">
                <Menu size={17} className="md:hidden" aria-hidden />
                <span className="grid size-7 place-items-center rounded-md bg-mint text-xs font-bold text-white">
                  {getUserInitial(activeUser.name)}
                </span>
                <span className="hidden max-w-24 truncate md:inline">{activeUser.name}</span>
              </summary>
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-md border border-line bg-white shadow-soft">
                <div className="border-b border-line px-3 py-3">
                  <p className="truncate text-sm font-semibold">{activeUser.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {activeUser.email ?? (isGuestAppUser(activeUser) ? "방문자 모드" : "로그인됨")}
                  </p>
                </div>
                <div className="grid p-1">
                  {utilityLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-700 hover:bg-panel"
                      >
                        <Icon size={16} aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-soft backdrop-blur md:hidden"
        aria-label="주요 메뉴"
      >
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium ${
                  active ? "bg-ink text-white" : "text-slate-600"
                }`}
              >
                <Icon size={18} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Dumbbell,
  Activity,
  ListChecks,
  LogOut,
  Settings,
  Sparkles,
  Utensils,
  UserRound,
  Wrench
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  activateAppUserFromAuth,
  clearActiveAppUser,
  getUserInitial,
  isAccountAuthUser,
  type AppUser
} from "@/lib/app-users";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const navItems = [
  { href: "/today", label: "오늘", icon: CalendarDays },
  { href: "/equipment", label: "기구", icon: Wrench },
  { href: "/exercises", label: "운동", icon: ListChecks },
  { href: "/workout", label: "루틴", icon: Dumbbell },
  { href: "/nutrition", label: "식단", icon: Utensils },
  { href: "/body", label: "인바디", icon: Activity },
  { href: "/settings", label: "설정", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeUser, setActiveUser] = useState<AppUser | null | undefined>(undefined);
  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    const goToLogin = () => {
      clearActiveAppUser();
      if (isMounted) setActiveUser(null);
      if (!isLoginRoute) {
        router.replace("/login");
      }
    };

    const refresh = async () => {
      if (!supabase) {
        goToLogin();
        return;
      }

      const { data } = await supabase.auth.getSession();
      const authUser = data.session?.user ?? null;
      if (!isAccountAuthUser(authUser)) {
        await supabase.auth.signOut();
        goToLogin();
        return;
      }

      const user = activateAppUserFromAuth(authUser);
      if (isMounted) setActiveUser(user);
    };

    void refresh();
    const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!isAccountAuthUser(session?.user)) {
        if (session?.user) void supabase.auth.signOut();
        goToLogin();
        return;
      }
      const user = activateAppUserFromAuth(session.user);
      if (isMounted) setActiveUser(user);
    });

    const handleUserChange = () => {
      void refresh();
    };
    window.addEventListener("storage", handleUserChange);
    return () => {
      isMounted = false;
      authListener?.data.subscription.unsubscribe();
      window.removeEventListener("storage", handleUserChange);
    };
  }, [isLoginRoute, router]);

  async function leaveUser() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    clearActiveAppUser();
    setActiveUser(null);
    router.push("/login");
  }

  if (isLoginRoute) {
    return <div className="min-h-screen text-ink">{children}</div>;
  }

  if (activeUser === undefined) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-sm font-semibold text-slate-500">
        계정 확인 중
      </div>
    );
  }

  if (!activeUser) {
    return null;
  }

  return (
    <div className="min-h-screen pb-24 text-ink md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-panel/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/today" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink text-white">
              <Sparkles size={20} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold md:text-base">
                어댑티브 데일리 피트니스 코치
              </span>
              <span className="block truncate text-xs text-slate-500">
                기구 기반 운동 계획
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
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <div className="flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700">
              <span className="grid size-7 place-items-center rounded-md bg-mint text-xs font-bold text-white">
                {getUserInitial(activeUser.name)}
              </span>
              <span className="max-w-24 truncate">{activeUser.name}</span>
            </div>
            <button
              type="button"
              onClick={leaveUser}
              className="grid size-10 place-items-center rounded-md border border-line bg-white text-slate-600"
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut size={17} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 py-2 shadow-soft backdrop-blur md:hidden"
        aria-label="주요 메뉴"
      >
        <div className="grid grid-cols-8 gap-1">
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
          <button
            type="button"
            onClick={leaveUser}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-slate-600"
          >
            <UserRound size={18} aria-hidden />
            <span className="max-w-full truncate px-1">{activeUser.name}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

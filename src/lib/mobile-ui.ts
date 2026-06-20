import type { DailyTrainingDecision } from "@/lib/daily-types";
import { formatBodyPart } from "@/lib/daily-planning";
import type { Intensity, WorkoutPlanItem } from "@/lib/types";

export const intensityLabels: Record<Intensity, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음"
};

export function formatNumber(value: number | null | undefined, suffix = "") {
  return value === null || value === undefined ? "-" : `${Math.round(value * 10) / 10}${suffix}`;
}

export function formatMinutes(value: number) {
  return `${Math.max(0, Math.round(value))}분`;
}

export function summarizeFocusMuscles(decision: DailyTrainingDecision, max = 3) {
  if (decision.sessionMode === "rest_recommended") return "회복 우선";
  const selected = decision.selectedMuscles
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .slice(0, max)
    .map((item) => formatBodyPart(item.muscle));
  return selected.length > 0 ? selected.join(" · ") : "전신 저강도 회복 세션";
}

export function countPlanSets(items: WorkoutPlanItem[]) {
  return items.reduce((sum, item) => sum + item.sets, 0);
}

export function countPlanWarmupSets(items: WorkoutPlanItem[]) {
  return items.reduce((sum, item) => sum + (item.warmupSets?.length ?? 0), 0);
}

export function getNextMealName(hour = new Date().getHours()) {
  if (hour < 10) return "아침";
  if (hour < 15) return "점심";
  if (hour < 18) return "간식";
  return "저녁";
}

export function formatDateShort(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 10).replaceAll("-", ".");
}

export function getUserActionError(error: unknown, fallback = "잠시 후 다시 시도하세요.") {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes("fetch")) return "네트워크 연결을 확인하세요. 로컬 기록은 계속 사용할 수 있습니다.";
  if (error.message.toLowerCase().includes("invalid login")) {
    return "이메일 또는 비밀번호를 확인하세요.";
  }
  return error.message || fallback;
}

import { NextResponse } from "next/server";
import { getShortCoachJson } from "@/lib/openai-server";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await getShortCoachJson({
    name: "inbody_coach_notes",
    instructions:
      "한국어로 인바디 추세를 해석하되 단일 측정값에 과도하게 반응하지 말고 운동/식단 조정 포인트를 제안하세요.",
    input: body,
    fallback: {
      summary: "인바디 기록은 추세 참고용으로만 사용하고, 오늘 부위 결정은 목표와 훈련 기록을 우선했습니다.",
      actions: ["2~4주 변화폭을 중심으로 보세요.", "수분 지표가 흔들리면 체지방/근육 변화를 단정하지 마세요."],
      fallbackUsed: true
    }
  });

  return NextResponse.json(result);
}

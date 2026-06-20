import { NextResponse } from "next/server";
import type { DailyTrainingContext } from "@/lib/daily-types";
import { getTrainingFocusDecision } from "@/lib/openai-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { context?: DailyTrainingContext };
    if (!body.context) {
      return NextResponse.json({ error: "context is required" }, { status: 400 });
    }

    const result = await getTrainingFocusDecision(body.context);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create training decision"
      },
      { status: 500 }
    );
  }
}

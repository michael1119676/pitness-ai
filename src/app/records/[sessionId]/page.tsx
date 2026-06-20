import { WorkoutSessionDetail } from "@/components/WorkoutSessionDetail";

export default async function RecordDetailPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <WorkoutSessionDetail sessionId={sessionId} />;
}

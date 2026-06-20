import { ExerciseHistoryDetail } from "@/components/ExerciseHistoryDetail";

export default async function ExerciseHistoryPage({
  params
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  return <ExerciseHistoryDetail exerciseId={exerciseId} />;
}

import FrequencyClient from "@/components/FrequencyClient";

export default async function FrequencyPage({
  searchParams,
}: {
  searchParams: Promise<{ wordId?: string }>;
}) {
  const sp = await searchParams;
  const wordId = Number(sp.wordId) > 0 ? Number(sp.wordId) : 6;
  return <FrequencyClient initialWordId={wordId} />;
}

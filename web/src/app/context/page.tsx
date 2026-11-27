import ContextExplorerClient from "@/components/ContextExplorerClient";

export default async function ContextPage({
  searchParams,
}: {
  searchParams: Promise<{ wordId?: string }>;
}) {
  const sp = await searchParams;
  const wordId = Number(sp.wordId) > 0 ? Number(sp.wordId) : 44; // Default: هدى
  return <ContextExplorerClient initialWordId={wordId} />;
}

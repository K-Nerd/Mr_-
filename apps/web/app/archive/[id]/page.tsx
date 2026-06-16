import { AppClient } from "../../AppClient";

export default async function ArchiveDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AppClient initialPage="archive-detail" selectedArchiveId={decodeURIComponent(id)} />;
}

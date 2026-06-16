import { AppClient } from "../../AppClient";

export default async function VideoDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AppClient initialPage="video-detail" selectedVideoId={decodeURIComponent(id)} />;
}

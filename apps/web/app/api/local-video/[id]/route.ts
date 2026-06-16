import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

type SourceRecord = {
  id?: string;
  kind?: string;
  video?: string;
};

function datasetCandidates() {
  return [
    path.resolve(process.cwd(), "apps/api/dataset"),
    path.resolve(process.cwd(), "../api/dataset"),
    path.resolve(process.cwd(), "../../apps/api/dataset"),
  ];
}

async function findDatasetRoot() {
  for (const candidate of datasetCandidates()) {
    try {
      await stat(path.join(candidate, "sources.json"));
      return candidate;
    } catch {
      // Try the next likely workspace root.
    }
  }
  return "";
}

function parseRange(rangeHeader: string | null, size: number) {
  if (!rangeHeader?.startsWith("bytes=")) return null;
  const [startText, endText] = rangeHeader.replace("bytes=", "").split("-");
  const start = Number.parseInt(startText, 10);
  const end = endText ? Number.parseInt(endText, 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end < start || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const datasetRoot = await findDatasetRoot();
  if (!datasetRoot) {
    return Response.json({ detail: "dataset root not found" }, { status: 404 });
  }

  const sourcesPath = path.join(datasetRoot, "sources.json");
  const payload = JSON.parse(await readFile(sourcesPath, "utf-8")) as { sources?: SourceRecord[] };
  const source = payload.sources?.find((item) => item.kind === "video" && item.id === decodeURIComponent(id));
  if (!source?.video) {
    return Response.json({ detail: `unknown local video id: ${id}` }, { status: 404 });
  }

  const filePath = path.resolve(datasetRoot, source.video);
  if (!filePath.startsWith(datasetRoot)) {
    return Response.json({ detail: "invalid video path" }, { status: 400 });
  }

  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return Response.json({ detail: `video file not found: ${source.video}` }, { status: 404 });
  }

  const range = parseRange(request.headers.get("range"), fileStat.size);
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": "video/mp4",
  });

  if (range) {
    const chunkSize = range.end - range.start + 1;
    headers.set("Content-Length", String(chunkSize));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);
    const stream = createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
  }

  headers.set("Content-Length", String(fileStat.size));
  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
}

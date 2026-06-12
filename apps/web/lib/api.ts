import type {
  AnswerResponse,
  BackendLogEntry,
  FeedbackResponse,
  KnowledgeSaveResponse,
  KnowhowResponse,
  MaterialKey,
  Position,
  SourceVideo,
  TrainingVideo,
  UploadResponse,
  VideoUploadResponse,
} from "@/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${message ? `: ${message}` : ""}`);
  }

  return response.json() as Promise<T>;
}

export async function getHealth(): Promise<{ status: string }> {
  return requestJson<{ status: string }>("/api/health");
}

export async function getMaterials(): Promise<MaterialKey[]> {
  return requestJson<MaterialKey[]>("/api/materials");
}

export async function getPositions(): Promise<Position[]> {
  return requestJson<Position[]>("/api/positions");
}

export async function getBackendLogs(): Promise<BackendLogEntry[]> {
  const payload = await requestJson<{ items: BackendLogEntry[] }>("/api/logs");
  return payload.items || [];
}

export async function getSources(): Promise<SourceVideo[]> {
  return requestJson<SourceVideo[]>("/api/sources");
}

export async function getTrainingVideos(params?: {
  material?: MaterialKey;
  position?: Position;
}): Promise<TrainingVideo[]> {
  const query = new URLSearchParams();
  if (params?.material) query.set("material", params.material);
  if (params?.position) query.set("position", params.position);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<TrainingVideo[]>(`/api/training-videos${suffix}`);
}

export async function getKnowhow(input: {
  material: MaterialKey;
  position: Position;
  query?: string;
  include_posture?: boolean;
}): Promise<KnowhowResponse> {
  return requestJson<KnowhowResponse>("/api/knowhow", {
    method: "POST",
    body: JSON.stringify({
      material: input.material,
      position: input.position,
      query: input.query || undefined,
      top_k: 5,
      include_posture: input.include_posture,
    }),
  });
}

export async function sendFeedback(input: {
  material: MaterialKey;
  position: Position;
  observation: string;
  uploadId?: string;
  dry_run?: boolean;
}): Promise<FeedbackResponse> {
  return requestJson<FeedbackResponse>("/api/feedback", {
    method: "POST",
    body: JSON.stringify({
      material: input.material,
      position: input.position,
      observation: input.observation,
      upload_id: input.uploadId,
      top_k: 5,
      dry_run: input.dry_run,
    }),
  });
}

export async function sendChatQuestion(input: {
  query: string;
  k?: number;
  dry_run?: boolean;
}): Promise<AnswerResponse> {
  return requestJson<AnswerResponse>("/api/answer", {
    method: "POST",
    body: JSON.stringify({
      query: input.query,
      k: input.k || 5,
      dry_run: input.dry_run,
    }),
  });
}

export async function getVideoStatus(sourceId: string): Promise<TrainingVideo> {
  return requestJson<TrainingVideo>(`/api/video-status/${encodeURIComponent(sourceId)}`);
}

export async function uploadWorkPhoto(input: {
  file: File;
  material?: MaterialKey;
  position?: Position;
}): Promise<UploadResponse> {
  const body = new FormData();
  body.append("file", input.file);
  if (input.material) body.append("material", input.material);
  if (input.position) body.append("position", input.position);

  return requestJson<UploadResponse>("/api/upload", {
    method: "POST",
    body,
  });
}

export async function uploadTrainingVideo(input: {
  file: File;
  sourceId?: string;
  title?: string;
  material?: MaterialKey;
  position?: Position;
  topic?: string;
  subtopic?: string;
}): Promise<VideoUploadResponse> {
  const body = new FormData();
  body.append("file", input.file);
  if (input.sourceId) body.append("source_id", input.sourceId);
  if (input.title) body.append("title", input.title);
  if (input.material) body.append("material", input.material);
  if (input.position) body.append("position", input.position);
  if (input.topic) body.append("topic", input.topic);
  if (input.subtopic) body.append("subtopic", input.subtopic);

  return requestJson<VideoUploadResponse>("/api/videos/upload", {
    method: "POST",
    body,
  });
}

export async function saveKnowledge(input: {
  material: MaterialKey;
  position: Position;
  stage: string;
  knowledge_type: string;
  defect: string;
  cause: string;
  solution: string;
  expert_tip: string;
  current: string;
  gas: string;
  source: string;
}): Promise<KnowledgeSaveResponse> {
  return requestJson<KnowledgeSaveResponse>("/api/knowledge", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function videoUrl(path?: string): string {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

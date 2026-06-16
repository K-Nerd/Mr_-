import type {
  AnswerResponse,
  BackendLogEntry,
  FeedbackResponse,
  ImageResponse,
  KnowledgeFileUploadResponse,
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

const ENABLE_API_CONSOLE_LOGS =
  typeof window !== "undefined" && process.env.NODE_ENV !== "production";

function previewRequestBody(body: BodyInit | null | undefined) {
  if (!body) return undefined;
  if (body instanceof FormData) {
    return Array.from(body.entries()).map(([key, value]) => ({
      key,
      value: value instanceof File
        ? { name: value.name, size: value.size, type: value.type || "unknown" }
        : value,
    }));
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return "[non-json body]";
}

function logApiCall(input: {
  path: string;
  method: string;
  url: string;
  status?: number;
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: unknown;
}) {
  if (!ENABLE_API_CONSOLE_LOGS) return;

  const statusLabel = input.status ? ` ${input.status}` : "";
  const label = `[FastAPI] ${input.method} ${input.path}${statusLabel} (${input.durationMs}ms)`;
  const logger = input.error ? console.warn : console.info;

  console.groupCollapsed(label);
  logger("url", input.url);
  if (input.requestBody !== undefined) logger("request", summarizeLogValue(input.requestBody));
  if (input.responseBody !== undefined) logger("response", summarizeLogValue(input.responseBody));
  if (input.error !== undefined) logger("error", summarizeLogValue(input.error));
  console.groupEnd();
}

function summarizeLogValue(value: unknown) {
  if (value instanceof Error) {
    return value.message.length > 240 ? `${value.message.slice(0, 240)}...` : value.message;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as { detail?: unknown };
      if (typeof parsed.detail === "string") {
        return parsed.detail.length > 240 ? `${parsed.detail.slice(0, 240)}...` : parsed.detail;
      }
      return parsed;
    } catch {
      return value.length > 240 ? `${value.slice(0, 240)}...` : value;
    }
  }
  return value;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method || "GET";
  const url = `${API_BASE_URL}${path}`;
  const requestBody = previewRequestBody(init?.body);
  const startedAt = performance.now();
  let logged = false;

  try {
    const requestInit = {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    };
    let response: Response | null = null;
    let fetchError: unknown = null;
    const attempts = method === "GET" ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        response = await fetch(url, requestInit);
        fetchError = null;
        break;
      } catch (error) {
        fetchError = error;
        if (attempt < attempts - 1) await wait(350);
      }
    }
    if (!response) throw fetchError instanceof Error ? fetchError : new Error("Failed to fetch");

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      const error = new Error(`${response.status} ${response.statusText}${message ? `: ${message}` : ""}`);
      logApiCall({
        path,
        method,
        url,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        requestBody,
        responseBody: message,
        error,
      });
      logged = true;
      throw error;
    }

    const payload = await response.json() as T;
    logApiCall({
      path,
      method,
      url,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      requestBody,
      responseBody: payload,
    });
    return payload;
  } catch (error) {
    if (!logged) {
      logApiCall({
        path,
        method,
        url,
        durationMs: Math.round(performance.now() - startedAt),
        requestBody,
        error,
      });
    }
    throw error;
  }
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
  material?: MaterialKey;
  position?: Position;
}): Promise<AnswerResponse> {
  return requestJson<AnswerResponse>("/api/answer", {
    method: "POST",
    body: JSON.stringify({
      query: input.query,
      k: input.k || 5,
      dry_run: input.dry_run,
      material: input.material,
      position: input.position,
    }),
  });
}

export async function generateImage(input: {
  prompt: string;
}): Promise<ImageResponse> {
  return requestJson<ImageResponse>("/api/image", {
    method: "POST",
    body: JSON.stringify({
      prompt: input.prompt,
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

export async function uploadKnowledgeFile(input: {
  file: File;
  material: MaterialKey;
  position: Position;
  stage: string;
  knowledge_type: string;
  source: string;
}): Promise<KnowledgeFileUploadResponse> {
  const body = new FormData();
  body.append("file", input.file);
  body.append("material", input.material);
  body.append("position", input.position);
  body.append("stage", input.stage);
  body.append("knowledge_type", input.knowledge_type);
  if (input.source) body.append("source", input.source);

  return requestJson<KnowledgeFileUploadResponse>("/api/knowledge-file", {
    method: "POST",
    body,
  });
}

export function videoUrl(path?: string): string {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

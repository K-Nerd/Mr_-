export type MaterialKey = "carbon_steel" | "stainless" | "aluminum";
export type Position = "1G" | "2G" | "5G" | "6G";

export type StageKey =
  | "preparation"
  | "root_pass"
  | "hot_pass"
  | "fill_pass"
  | "cap_pass"
  | "defect_correction";

export type PageKey =
  | "dashboard"
  | "videos"
  | "video-detail"
  | "chat"
  | "feedback"
  | "archive"
  | "archive-detail"
  | "input";

export interface ContextFilters {
  material: MaterialKey;
  position: Position;
  stage: StageKey;
}

export interface TrainingVideo {
  id: string;
  title: string;
  material?: MaterialKey | "";
  position?: Position | "";
  video_url?: string;
  video?: string;
  video_available?: boolean;
  topic?: string;
  subtopic?: string;
}

export interface SourceVideo extends TrainingVideo {
  topic?: string;
  subtopic?: string;
}

export interface Citation {
  id: string;
  title: string;
  video?: string;
  video_url?: string;
  video_available?: boolean;
  material?: MaterialKey | "";
  position?: Position | "";
  topic?: string;
  subtopic?: string;
}

export interface AnswerHit {
  id: string;
  score?: number;
  material?: MaterialKey | "";
  position?: Position | "";
  type?: string;
  stage?: string;
  defect?: string;
  text?: string;
  source_ids?: string[];
  source_file?: string;
}

export interface AnswerResponse {
  answer: string;
  routing?: {
    material?: MaterialKey | "";
    position?: Position | "";
    reason?: string;
  };
  citations?: Citation[];
  citations_markdown?: string;
  hits?: AnswerHit[];
}

export interface FeedbackPayload {
  summary: string;
  key_points: string[];
  warnings: string[];
  next_steps: string[];
}

export interface FeedbackResponse {
  classification?: {
    material: MaterialKey;
    position: Position;
  };
  observation?: string | null;
  feedback: FeedbackPayload;
  knowhow?: {
    parameters?: Record<string, unknown> | null;
    guide_sections_count?: number;
    tips_count?: number;
    defects_count?: number;
  };
  citations?: Citation[];
  training_videos?: TrainingVideo[];
  llm?: {
    provider?: string;
    model?: string;
    used_env?: string;
    dry_run?: boolean;
    vision?: boolean;
    reason?: string;
  };
  image?: {
    upload_id?: string | null;
    mime_type?: string;
    size_bytes?: number;
    status?: string;
    reason?: string;
  };
}

export interface KnowhowResponse {
  material: MaterialKey;
  position: Position;
  query?: string | null;
  parameters?: Record<string, unknown> | null;
  expert_tips?: Array<{
    stage?: string;
    tip?: string;
  }>;
  defect_solutions?: Array<{
    defect?: string;
    cause?: string;
    solution?: string;
  }>;
  qa?: Array<{
    question?: string;
    answer?: string;
  }>;
  guide_sections?: Array<{
    title?: string;
    body?: string;
  }>;
  posture_notes?: Array<{
    subtopic?: string;
    type?: string;
    tip?: string;
    question?: string;
    defect?: string;
    cause?: string;
    solution?: string;
  }> | null;
  citations?: Citation[];
  missing_videos?: string[];
}

export interface UploadResponse {
  upload_id: string;
  stored_path: string;
  original_filename: string;
  size_bytes: number;
  classification: {
    material: MaterialKey;
    position: Position;
    confidence: number;
    source: string;
  };
}

export interface VideoUploadResponse {
  status: string;
  source: TrainingVideo;
  size_bytes: number;
  stored_path: string;
}

export interface KnowledgeSaveResponse {
  status: string;
  entry: Record<string, string>;
  knowhow: KnowhowResponse;
}

export interface BackendLogEntry {
  time: string;
  method: string;
  path: string;
  query?: string;
  status: number;
  duration_ms: number;
  provider?: string;
  model?: string;
  env?: string | null;
}

export interface ArchiveItem {
  id: string;
  type: "tip" | "defect" | "qa" | "guide" | "posture" | "parameters";
  title: string;
  body: string;
  material: MaterialKey;
  position: Position;
  stage?: string;
  status: "indexed" | "reviewed" | "draft" | "needs-source";
  sourceIds: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  response?: FeedbackResponse;
  answer?: AnswerResponse;
}

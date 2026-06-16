"use client";

import type { ChangeEvent, CSSProperties, FormEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getKnowhow,
  getMaterials,
  getPositions,
  getSources,
  getTrainingVideos,
  generateImage,
  sendChatQuestion,
  sendFeedback,
  saveKnowledge,
  uploadKnowledgeFile,
  uploadTrainingVideo,
  uploadWorkPhoto,
  videoUrl,
} from "@/lib/api";
import type {
  AnswerHit,
  AnswerResponse,
  ArchiveItem,
  ChatMessage,
  ContextFilters,
  FeedbackResponse,
  ImageResponse,
  KnowledgeFileUploadResponse,
  KnowhowResponse,
  MaterialKey,
  PageKey,
  Position,
  RagUpdateResult,
  SourceVideo,
  StageKey,
  TrainingVideo,
  UploadResponse,
} from "@/types";

const BRAND = "\ub9c8\uc2a4\ud130-\uce74\ud53c";

const MATERIAL_LABEL: Record<MaterialKey, string> = {
  carbon_steel: "\ud0c4\uc18c\uac15",
  stainless: "\uc2a4\ud14c\uc778\ub9ac\uc2a4",
  aluminum: "\uc54c\ub8e8\ubbf8\ub284",
};

const STAGE_LABEL: Record<StageKey, string> = {
  preparation: "\uc900\ube44",
  root_pass: "\ub8e8\ud2b8\ud328\uc2a4",
  hot_pass: "\ud56b\ud328\uc2a4",
  fill_pass: "\ucc44\uc6c0\ud328\uc2a4",
  cap_pass: "\ucea1\ud328\uc2a4",
  defect_correction: "\uacb0\ud568 \uad50\uc815",
};

const PAGE_LABEL: Record<PageKey, string> = {
  dashboard: "\ub300\uc2dc\ubcf4\ub4dc",
  videos: "\uc791\uc5c5 \uc601\uc0c1",
  "video-detail": "\uc601\uc0c1 \uc0c1\uc138",
  chat: "\ub178\ud558\uc6b0 \ucc57\ubd07",
  feedback: "\uc0ac\uc9c4 \ud53c\ub4dc\ubc31",
  community: "\ucee4\ubba4\ub2c8\ud2f0",
  archive: "\uc9c0\uc2dd \uc544\uce74\uc774\ube0c",
  "archive-detail": "\uc9c0\uc2dd \uc0c1\uc138",
  input: "\uc219\ub828\uacf5 \ub178\ud558\uc6b0 \uc5c5\ub85c\ub4dc",
};

const STAGE_OPTIONS = Object.keys(STAGE_LABEL) as StageKey[];
const FALLBACK_MATERIALS: MaterialKey[] = ["carbon_steel", "stainless", "aluminum"];
const FALLBACK_POSITIONS: Position[] = ["1G", "2G", "5G", "6G"];

const NAV_ITEMS: Array<{ key: PageKey; label: string; meta: string; glyph: string }> = [
  { key: "dashboard", label: PAGE_LABEL.dashboard, meta: "전체 현황", glyph: "DB" },
  { key: "input", label: PAGE_LABEL.input, meta: "노하우 등록", glyph: "UP" },
  { key: "videos", label: PAGE_LABEL.videos, meta: "영상", glyph: "VD" },
  { key: "chat", label: PAGE_LABEL.chat, meta: "질문 답변", glyph: "AI" },
  { key: "feedback", label: PAGE_LABEL.feedback, meta: "사진 분석", glyph: "FB" },
  { key: "community", label: PAGE_LABEL.community, meta: "게시판", glyph: "CM" },
];

const PAGE_ROUTE: Partial<Record<PageKey, string>> = {
  dashboard: "/dashboard",
  input: "/knowhow-upload",
  videos: "/videos",
  chat: "/chat",
  feedback: "/feedback",
  community: "/community",
  archive: "/archive",
};

function routeForPage(page: PageKey) {
  return PAGE_ROUTE[page] || "/dashboard";
}

function getVideoPlaybackUrl(video?: TrainingVideo | SourceVideo | null) {
  if (!video || video.video_available === false) return "";
  if (video.video_url) {
    return video.video_url.startsWith("/api/local-video") ? video.video_url : videoUrl(video.video_url);
  }
  if (video.id && (video.video || video.video_available)) {
    return videoUrl(`/api/video/${encodeURIComponent(video.id)}`);
  }
  return "";
}

function getVideoPreviewUrl(video?: TrainingVideo | SourceVideo | null) {
  const playbackUrl = getVideoPlaybackUrl(video);
  return playbackUrl ? `${playbackUrl}#t=1` : "";
}

const SAMPLE_PROMPTS = [
  "스테인리스 6G 루트패스에서 6시 방향 비드가 꺼질 때 먼저 무엇을 확인해야 하나요?",
  "탄소강 5G 핫패스 이후 언더컷이 생기면 원인이 무엇일까요?",
  "알루미늄 TIG에서 용융지가 불안정할 때 진행 속도는 어떻게 조정하나요?",
];

const FALLBACK_VIDEOS: TrainingVideo[] = [
  {
    id: "video_ss_6g",
    title: "6 inch stainless pipe TIG welding process",
    material: "stainless",
    position: "6G",
    video_url: "/api/local-video/video_ss_6g",
    video: "video/stainless steel 6G pipe TIG welding.mp4",
    video_available: true,
  },
  {
    id: "local_stainless_welding",
    title: "스테인리스 용접 영상",
    material: "stainless",
    position: "6G",
    video_url: "/api/local-video/local_stainless_welding",
    video: "video/local-stainless-welding.mp4",
    video_available: true,
  },
  {
    id: "local_carbon_steel_welding",
    title: "탄소강 용접 영상",
    material: "carbon_steel",
    position: "5G",
    video_url: "/api/local-video/local_carbon_steel_welding",
    video: "video/local-carbon-steel-welding.mp4",
    video_available: true,
  },
  {
    id: "local_aluminum_welding2",
    title: "알루미늄 용접 영상",
    material: "aluminum",
    position: "2G",
    video_url: "/api/local-video/local_aluminum_welding2",
    video: "video/local-aluminum-welding2.mp4",
    video_available: true,
  },
];

const FALLBACK_KNOWHOW: KnowhowResponse = {
  material: "stainless",
  position: "6G",
  parameters: {
    current_range: "82-88A",
    gas_flow: "30-35 CFH",
    tungsten: "2.4mm",
    filler: "ER308L",
  },
  expert_tips: [
    {
      stage: "root_pass",
      tip: "Lock the wrist before moving through the bottom quadrant. Keep the arc short and feed filler after the puddle wets both edges.",
    },
    {
      stage: "cap_pass",
      tip: "Use a slower pause at each edge than at the center. The bead should look slightly crowned, not flat.",
    },
  ],
  defect_solutions: [
    {
      defect: "Suck-back",
      cause: "Too much heat input or filler added late at the bottom side of the pipe.",
      solution: "Reduce amperage by 3-5A, shorten the arc, and feed filler earlier at the leading edge.",
    },
    {
      defect: "Porosity",
      cause: "Poor gas coverage, dirty prep, or too much torch angle.",
      solution: "Re-clean the joint, verify gas flow, and keep the cup closer to the weld pool.",
    },
  ],
  qa: [
    {
      question: "What is the first check when the root bead is unstable?",
      answer: "Confirm fit-up, purge quality, arc length, and whether filler is being added before the puddle opens.",
    },
  ],
  guide_sections: [
    {
      title: "Training flow",
      body: "Watch the matching pipe-position video, ask the chatbot for expert rationale, then upload a work photo for corrective feedback.",
    },
  ],
  posture_notes: [
    {
      subtopic: "6G lower quadrant",
      tip: "Support the torch hand before the puddle reaches 6 o'clock. Move the elbow, not only the fingers.",
    },
  ],
  citations: [
    {
      id: "demo_stainless_6g_root",
      title: "Stainless 6G root pass source clip",
      material: "stainless",
      position: "6G",
    },
  ],
};

interface InputDraft {
  material: MaterialKey;
  position: Position;
  stage: StageKey;
  knowledgeType: string;
  defect: string;
  cause: string;
  solution: string;
  expertTip: string;
  current: string;
  gas: string;
  source: string;
}

export function AppClient({
  initialPage,
  selectedVideoId,
  selectedArchiveId,
}: {
  initialPage: PageKey;
  selectedVideoId?: string;
  selectedArchiveId?: string;
}) {
  const router = useRouter();
  const page = initialPage;
  const [filters, setFilters] = useState<ContextFilters>({
    material: "stainless",
    position: "6G",
    stage: "root_pass",
  });
  const [materials, setMaterials] = useState<MaterialKey[]>(FALLBACK_MATERIALS);
  const [positions, setPositions] = useState<Position[]>(FALLBACK_POSITIONS);
  const [videos, setVideos] = useState<TrainingVideo[]>(fallbackVideos(filters));
  const [sources, setSources] = useState<SourceVideo[]>([]);
  const [knowhow, setKnowhow] = useState<KnowhowResponse | null>(fallbackKnowhow(filters));
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
  const [selectedArchive, setSelectedArchive] = useState<ArchiveItem | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [drawerWidth, setDrawerWidth] = useState(340);
  const [chatLogHeight, setChatLogHeight] = useState(470);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-assistant",
      role: "assistant",
      content: "안녕하세요. 파이프 TIG 용접 챗봇입니다. 궁금한 용접 상황을 편하게 질문해 주세요.",
      createdAt: "안내",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoMemo, setPhotoMemo] = useState("Bottom side bead is uneven and the root looks slightly concave.");
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<FeedbackResponse | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const [inputDraft, setInputDraft] = useState<InputDraft>({
    material: "stainless",
    position: "6G",
    stage: "root_pass",
    knowledgeType: "defect_solution",
    defect: "Suck-back",
    cause: "The bottom quadrant is overheating and filler is added too late.",
    solution: "Drop current by 3-5A, shorten the arc, and feed filler at the leading edge before the puddle opens.",
    expertTip: "Stabilize the torch hand before entering the 6 o'clock zone.",
    current: "82-85A",
    gas: "30-35 CFH",
    source: "demo_stainless_6g_root",
  });

  const startDrawerResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = drawerWidth;

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      setDrawerWidth(Math.min(520, Math.max(260, nextWidth)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startChatResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = chatLogHeight;

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY);
      const maxHeight = Math.max(900, window.innerHeight * 1.45);
      setChatLogHeight(Math.min(maxHeight, Math.max(180, nextHeight)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    let alive = true;

    async function loadBase() {
      try {
        const [nextMaterials, nextPositions, nextSources] = await Promise.all([
          getMaterials(),
          getPositions(),
          getSources(),
        ]);
        if (!alive) return;
        setMaterials(nextMaterials.length ? nextMaterials : FALLBACK_MATERIALS);
        setPositions(nextPositions.length ? nextPositions : FALLBACK_POSITIONS);
        setSources(nextSources);
      } catch {
        if (!alive) return;
        setMaterials(FALLBACK_MATERIALS);
        setPositions(FALLBACK_POSITIONS);
        setSources([]);
      }
    }

    loadBase();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadContextData() {
      setLoadingData(true);
      setDataError("");
      try {
        const [nextVideos, nextKnowhow] = await Promise.all([
          getTrainingVideos({ material: filters.material, position: filters.position }),
          getKnowhow({
            material: filters.material,
            position: filters.position,
            include_posture: filters.position === "6G",
          }),
        ]);
        if (!alive) return;
        const mergedVideos = nextVideos.length ? nextVideos : fallbackVideos(filters);
        setVideos(mergedVideos);
        setKnowhow(nextKnowhow);
        setSelectedVideo(mergedVideos[0] || null);
      } catch (error) {
        if (!alive) return;
        setDataError(error instanceof Error ? error.message : "Could not load API data.");
        const fallback = fallbackVideos(filters);
        setVideos(fallback);
        setKnowhow(fallbackKnowhow(filters));
        setSelectedVideo(fallback[0] || null);
      } finally {
        if (alive) setLoadingData(false);
      }
    }

    loadContextData();
    return () => {
      alive = false;
    };
  }, [filters]);

  const archiveItems = useMemo(() => knowhowToArchiveItems(knowhow), [knowhow]);
  const activeVideo = useMemo(() => {
    if (selectedVideoId) {
      const allVideos: Array<TrainingVideo | SourceVideo> = [...videos, ...sources, ...FALLBACK_VIDEOS];
      const fromRoute = allVideos.find((video) => video.id === selectedVideoId);
      if (fromRoute) return fromRoute;
    }
    return selectedVideo || videos[0] || sources[0] || null;
  }, [selectedVideoId, selectedVideo, videos, sources]);
  const activeArchive = useMemo(() => {
    if (selectedArchiveId) {
      const fromRoute = archiveItems.find((item) => item.id === selectedArchiveId);
      if (fromRoute) return fromRoute;
    }
    return selectedArchive || archiveItems[0] || null;
  }, [selectedArchiveId, selectedArchive, archiveItems]);
  const drawerCitations = useMemo(() => {
    const citations = [
      ...(knowhow?.citations || []),
      ...(chatMessages.at(-1)?.response?.citations || []),
      ...(chatMessages.at(-1)?.answer?.citations || []),
      ...(photoFeedback?.citations || []),
    ];
    return Array.from(new Map(citations.map((item) => [item.id, item])).values()).slice(0, 5);
  }, [knowhow, chatMessages, photoFeedback]);

  const refreshCurrentData = async () => {
    setLoadingData(true);
    setDataError("");
    try {
      const [nextVideos, nextSources, nextKnowhow] = await Promise.all([
        getTrainingVideos({ material: filters.material, position: filters.position }),
        getSources(),
        getKnowhow({
          material: filters.material,
          position: filters.position,
          include_posture: filters.position === "6G",
        }),
      ]);
      const mergedVideos = nextVideos.length ? nextVideos : fallbackVideos(filters);
      setVideos(mergedVideos);
      setSources(nextSources);
      setKnowhow(nextKnowhow);
      setSelectedVideo(mergedVideos[0] || null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not refresh API data.");
    } finally {
      setLoadingData(false);
    }
  };

  const changeFilter = <K extends keyof ContextFilters>(key: K, value: ContextFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const goTo = (nextPage: PageKey) => {
    if (nextPage === "archive-detail" && !selectedArchive && archiveItems[0]) {
      setSelectedArchive(archiveItems[0]);
    }
    router.push(routeForPage(nextPage));
  };

  const openVideo = (video: TrainingVideo) => {
    setSelectedVideo(video);
    router.push(`/videos/${encodeURIComponent(video.id)}`);
  };

  const openArchive = (item: ArchiveItem) => {
    setSelectedArchive(item);
    router.push(`/archive/${encodeURIComponent(item.id)}`);
  };

  const askAboutVideo = (video: TrainingVideo) => {
    setChatInput(`Based on "${cleanTitle(video.title)}", explain the key risks for ${MATERIAL_LABEL[filters.material]} ${filters.position} ${STAGE_LABEL[filters.stage]}.`);
    router.push("/chat");
  };

  const submitChat = async (event?: FormEvent, text?: string) => {
    event?.preventDefault();
    const content = (text || chatInput).trim();
    if (!content || chatLoading || imageLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: formatTime(),
    };
    setChatMessages((current) => [...current, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await sendChatQuestion({
        query: content,
        k: 5,
        material: filters.material,
        position: filters.position,
      });
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          createdAt: formatTime(),
          answer: response,
        },
      ]);
    } catch {
      const response = fallbackAnswer(filters, content, knowhow || fallbackKnowhow(filters));
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-fallback-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          createdAt: formatTime(),
          answer: response,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const submitChatImage = async () => {
    const prompt = chatInput.trim();
    if (!prompt || chatLoading || imageLoading) return;

    const userMessage: ChatMessage = {
      id: `user-image-${Date.now()}`,
      role: "user",
      content: prompt,
      createdAt: formatTime(),
    };
    setChatMessages((current) => [...current, userMessage]);
    setChatInput("");
    setImageLoading(true);

    try {
      const image = await generateImage({ prompt });
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-image-${Date.now()}`,
          role: "assistant",
          content: image.text || "요청하신 이미지를 생성했습니다.",
          createdAt: formatTime(),
          image,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error && error.message.includes("할당량")
        ? "현재 Google 프로젝트의 이미지 생성 모델 할당량이 부족합니다. billing 또는 quota를 열면 같은 버튼으로 실제 이미지가 생성됩니다."
        : "이미지 생성 중 문제가 발생했습니다. 잠시 후 다시 시도하거나 API 키와 이미지 모델 설정을 확인해 주세요.";
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-image-error-${Date.now()}`,
          role: "assistant",
          content: message,
          createdAt: formatTime(),
        },
      ]);
    } finally {
      setImageLoading(false);
    }
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setUploadResult(null);
    setPhotoFeedback(null);
    setPhotoError("");
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  const runPhotoFeedback = async () => {
    if (!photoFile || photoLoading) {
      setPhotoError("먼저 작업 사진을 업로드하세요.");
      return;
    }

    setPhotoLoading(true);
    setPhotoError("");
    try {
      const upload = await uploadWorkPhoto({
        file: photoFile,
        material: filters.material,
        position: filters.position,
      });
      setUploadResult(upload);
      const response = await sendFeedback({
        material: upload.classification.material,
        position: upload.classification.position,
        observation: `[Photo feedback / ${STAGE_LABEL[filters.stage]}] ${photoMemo || "Review the uploaded bead photo."}`,
        uploadId: upload.upload_id,
      });
      setPhotoFeedback(response);
    } catch {
      const upload: UploadResponse = {
        upload_id: `local-${Date.now()}`,
        stored_path: photoFile.name,
        original_filename: photoFile.name,
        size_bytes: photoFile.size,
        classification: {
          material: filters.material,
          position: filters.position,
          confidence: 0.72,
          source: "local-demo",
        },
      };
      setUploadResult(upload);
      setPhotoFeedback(fallbackFeedback(filters, photoMemo, knowhow || fallbackKnowhow(filters)));
    } finally {
      setPhotoLoading(false);
    }
  };

  const updateDraft = <K extends keyof InputDraft>(key: K, value: InputDraft[K]) => {
    setInputDraft((current) => ({ ...current, [key]: value }));
  };

  const renderMain = () => {
    switch (page) {
      case "dashboard":
        return (
          <DashboardPage
            filters={filters}
            onNavigate={goTo}
          />
        );
      case "videos":
        return (
          <VideosPage
            filters={filters}
            videos={videos}
            sources={sources}
            loading={loadingData}
            error={dataError}
            onOpenVideo={openVideo}
            onUploaded={refreshCurrentData}
          />
        );
      case "video-detail":
        return (
          <VideoDetailPage
            video={activeVideo}
            knowhow={knowhow}
            onBack={() => router.push("/videos")}
            onAsk={askAboutVideo}
            onFeedback={() => router.push("/feedback")}
          />
        );
      case "chat":
        return (
          <ChatPage
            messages={chatMessages}
            input={chatInput}
            loading={chatLoading}
            imageLoading={imageLoading}
            filters={filters}
            chatLogHeight={chatLogHeight}
            onStartResize={startChatResize}
            onInput={setChatInput}
            onSubmit={submitChat}
            onGenerateImage={submitChatImage}
          />
        );
      case "feedback":
        return (
          <PhotoFeedbackPage
            filters={filters}
            file={photoFile}
            preview={photoPreview}
            memo={photoMemo}
            uploadResult={uploadResult}
            feedback={photoFeedback}
            loading={photoLoading}
            error={photoError}
            onMemo={setPhotoMemo}
            onFile={handlePhoto}
            onRun={runPhotoFeedback}
          />
        );
      case "archive":
        return (
          <KnowledgeArchivePage
            items={archiveItems}
            knowhow={knowhow}
            loading={loadingData}
            onOpen={openArchive}
          />
        );
      case "archive-detail":
        return (
          <ArchiveDetailPage
            item={activeArchive}
            knowhow={knowhow}
            onBack={() => router.push("/archive")}
            onAsk={() => router.push("/chat")}
          />
        );
      case "input":
        return <MasterInputPage draft={inputDraft} sources={sources} onUpdate={updateDraft} onSaved={refreshCurrentData} />;
      case "community":
        return <CommunityPage filters={filters} />;
      default:
        return null;
    }
  };

  const showInsightDrawer = page !== "dashboard" && page !== "community";

  return (
    <div className="mc-app">
      <Sidebar page={page} onNavigate={goTo} />
      <div className="mc-main">
        <Topbar
          page={page}
          filters={filters}
          materials={materials}
          positions={positions}
          onFilter={changeFilter}
        />
        <div
          className={`mc-content ${showInsightDrawer ? "" : "no-drawer"}`}
          style={{ "--drawer-width": `${drawerWidth}px` } as CSSProperties}
        >
          <main className="mc-workspace">{renderMain()}</main>
          {showInsightDrawer && (
            <>
              <div className="layout-resizer" role="separator" aria-label="요약 패널 너비 조절" onPointerDown={startDrawerResize} />
              <InsightDrawer
                page={page}
                filters={filters}
                videos={videos}
                citations={drawerCitations}
                knowhow={knowhow}
                photoFeedback={photoFeedback}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  onNavigate,
}: {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">MC</div>
        <div>
          <strong>{BRAND}</strong>
          <span>숙련공 노하우 시스템</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="주요 메뉴">
        {NAV_ITEMS.map((item) => {
          const active =
            page === item.key ||
            (item.key === "videos" && page === "video-detail") ||
            (item.key === "archive" && page === "archive-detail");
          return (
            <button key={item.key} className={`nav-item ${active ? "active" : ""}`} type="button" onClick={() => onNavigate(item.key)}>
              <span className="nav-glyph">{item.glyph}</span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.meta}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="operator-card">
          <span className="operator-avatar">OP</span>
          <span>
            <strong>교육 관리자</strong>
            <small>현장 모드</small>
          </span>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  page,
  filters,
  materials,
  positions,
  onFilter,
}: {
  page: PageKey;
  filters: ContextFilters;
  materials: MaterialKey[];
  positions: Position[];
  onFilter: <K extends keyof ContextFilters>(key: K, value: ContextFilters[K]) => void;
}) {
  return (
    <header className="topbar">
      <div>
        <div className="breadcrumb">MC-COPY / {pageTitle(page)}</div>
        <h1>{pageTitle(page)}</h1>
      </div>
      <div className="context-controls">
        <label>
          <span>재질</span>
          <select value={filters.material} onChange={(event) => onFilter("material", event.target.value as MaterialKey)}>
            {materials.map((item) => (
              <option key={item} value={item}>
                {MATERIAL_LABEL[item] || item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>자세</span>
          <select value={filters.position} onChange={(event) => onFilter("position", event.target.value as Position)}>
            {positions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>공정</span>
          <select value={filters.stage} onChange={(event) => onFilter("stage", event.target.value as StageKey)}>
            {STAGE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {STAGE_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}

function DashboardPage({
  filters,
  onNavigate,
}: {
  filters: ContextFilters;
  onNavigate: (page: PageKey) => void;
}) {
  return (
    <section className="page-stack dashboard-clean">
      <div className="dashboard-intro">
        <div>
          <span className="eyebrow">노하우 전수 허브</span>
          <h2>{BRAND}는 숙련공의 판단을 작업자에게 바로 전달하는 파이프 TIG 용접 훈련 시스템입니다.</h2>
          <p>
            작업자는 재질과 자세를 고른 뒤 훈련 영상을 확인하고, 챗봇으로 노하우를 질문하며,
            작업 사진을 올려 교정 방향을 받을 수 있습니다. 현재 기준은 {MATERIAL_LABEL[filters.material]} / {filters.position} / {STAGE_LABEL[filters.stage]}입니다.
          </p>
        </div>
        <div className="dashboard-actions">
          <button className="primary-button" type="button" onClick={() => onNavigate("videos")}>
            작업 영상 보기
          </button>
          <button className="primary-button" type="button" onClick={() => onNavigate("chat")}>
            노하우 질문하기
          </button>
          <button className="secondary-button" type="button" onClick={() => onNavigate("feedback")}>
            사진 피드백 받기
          </button>
        </div>
      </div>

      <div className="dashboard-feature-grid">
        <article>
          <span>01</span>
          <h3>영상으로 먼저 맞춥니다</h3>
          <p>재질과 자세에 맞는 실제 작업 영상을 연결해 작업자가 같은 장면을 보며 연습할 수 있습니다.</p>
        </article>
        <article>
          <span>02</span>
          <h3>숙련공 노하우를 답변합니다</h3>
          <p>현장 팁, 결함 원인, 교정 순서를 챗봇 답변과 근거 자료로 함께 확인합니다.</p>
        </article>
        <article>
          <span>03</span>
          <h3>사진으로 교정 방향을 잡습니다</h3>
          <p>작업 결과 사진을 올리면 비드 상태와 재연습 포인트를 훈련 흐름에 맞춰 정리합니다.</p>
        </article>
      </div>

      <div className="dashboard-flow">
        <strong>발표 흐름</strong>
        <div>
          <span>재질/자세 선택</span>
          <i />
          <span>작업 영상 확인</span>
          <i />
          <span>챗봇 질문</span>
          <i />
          <span>사진 피드백</span>
        </div>
      </div>
    </section>
  );
}

function VideosPage({
  filters,
  videos,
  sources,
  loading,
  error,
  onOpenVideo,
  onUploaded,
}: {
  filters: ContextFilters;
  videos: TrainingVideo[];
  sources: SourceVideo[];
  loading: boolean;
  error: string;
  onOpenVideo: (video: TrainingVideo) => void;
  onUploaded: () => Promise<void>;
}) {
  const merged = videos.length ? videos : sources;
  const sortedVideos = [...merged].sort((left, right) => Number(Boolean(getVideoPlaybackUrl(right))) - Number(Boolean(getVideoPlaybackUrl(left))));
  const playableCount = sortedVideos.filter((video) => getVideoPlaybackUrl(video)).length;
  const sourceOptions = sources.length ? sources : merged;
  const defaultSource = sourceOptions.find((item) => item.material === filters.material && item.position === filters.position) || sourceOptions[0];
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState(defaultSource?.id || "");
  const [videoTitle, setVideoTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const effectiveSourceId = sourceId || defaultSource?.id || "";

  const runVideoUpload = async () => {
    if (!videoFile || uploading) {
      setUploadStatus("먼저 영상 파일을 선택하세요.");
      return;
    }
    setUploading(true);
    setUploadStatus("");
    try {
      const result = await uploadTrainingVideo({
        file: videoFile,
        sourceId: effectiveSourceId || undefined,
        title: videoTitle || undefined,
        material: filters.material,
        position: filters.position,
      });
      setUploadStatus(`Uploaded: ${result.source.id} / ${result.stored_path}`);
      setVideoFile(null);
      await onUploaded();
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Video upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="page-stack">
      <SectionHeader
        title={PAGE_LABEL.videos}
        body="재질과 자세에 맞는 작업 영상을 모아 보여줍니다. 영상 파일이 연결되면 바로 재생되고, 없으면 등록 정보만 표시됩니다."
        right={<span className="chip">{loading ? "불러오는 중" : `${playableCount}/${sortedVideos.length}개 재생 가능`}</span>}
      />
      {error && (
        <Callout
          tone="amber"
          title="API 연결 필요"
          body={`영상 메타데이터를 FastAPI에서 불러오지 못해 로컬 fallback 정보를 표시 중입니다. 별도 터미널에서 npm.cmd run dev:api 실행 후 새로고침하세요. 상세: ${error}`}
        />
      )}
      <Panel title="작업 영상 등록" meta="영상 연결">
        <div className="video-upload-grid">
          <label className="form-field">
            <span>연결할 영상 항목</span>
            <select value={effectiveSourceId} onChange={(event) => setSourceId(event.target.value)}>
              <option value="">새 항목으로 등록</option>
              {sourceOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} / {cleanTitle(item.title)}
                </option>
              ))}
            </select>
          </label>
          <TextField label="영상 제목 수정" value={videoTitle} onChange={setVideoTitle} />
          <label className="form-field">
            <span>영상 파일</span>
            <input
              accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.m4v"
              type="file"
              onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
            />
          </label>
          <button className="primary-button wide" type="button" onClick={runVideoUpload} disabled={uploading}>
            {uploading ? "업로드 중..." : "영상 업로드 및 연결"}
          </button>
        </div>
        {uploadStatus && <Callout tone={uploadStatus.startsWith("Uploaded") ? "green" : "amber"} title="업로드 상태" body={uploadStatus} />}
      </Panel>
      <div className="video-grid">
        {sortedVideos.map((video) => (
          <VideoCard key={video.id} video={video} onOpen={onOpenVideo} />
        ))}
      </div>
      {!sortedVideos.length && <EmptyState title="영상 데이터 없음" body="FastAPI 백엔드를 실행하거나 백엔드 데이터 폴더에 영상을 추가하세요." />}
    </section>
  );
}

function VideoDetailPage({
  video,
  knowhow,
  onBack,
  onAsk,
  onFeedback,
}: {
  video: TrainingVideo | SourceVideo | null;
  knowhow: KnowhowResponse | null;
  onBack: () => void;
  onAsk: (video: TrainingVideo) => void;
  onFeedback: () => void;
}) {
  if (!video) return <EmptyState title="선택된 영상 없음" body="먼저 작업 영상을 선택하세요." />;

  const path = getVideoPlaybackUrl(video);
  const chapters = [
    { time: "00:00", label: "개선 준비와 맞춤 확인" },
    { time: "01:30", label: "토치 각도와 용융지 시작" },
    { time: "03:20", label: "용가재 리듬과 입열 조절" },
    { time: "05:10", label: "결함 확인과 교정" },
  ];

  return (
    <section className="page-stack">
      <button className="link-button" type="button" onClick={onBack}>
        영상 목록으로
      </button>
      <div className="video-detail-layout">
        <div className="video-player-panel">
          <div className="video-player-frame">
            {path ? (
              <video controls src={path} />
            ) : (
              <div className="video-missing">
                <div className="synthetic-weld" />
                <span>영상 정보는 연결되었지만 mp4 파일이 아직 apps/api/dataset/video에 없습니다.</span>
              </div>
            )}
          </div>
          <div className="video-detail-copy">
            <span className="chip">{video.id}</span>
            <span className={`chip ${video.video_available ? "green" : "amber"}`}>{video.video_available ? "영상 준비됨" : "정보만 있음"}</span>
            <h2>{cleanTitle(video.title)}</h2>
            <p>{labelForMaterial(video.material)} / {video.position || "공통"} 작업 참고 영상입니다. 원본 경로: {video.video || "백엔드 영상 엔드포인트"}.</p>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={() => onAsk(video)}>
                이 영상으로 질문하기
              </button>
              <button className="secondary-button" type="button" onClick={onFeedback}>
                작업 사진 올리기
              </button>
            </div>
          </div>
        </div>
        <div className="side-stack">
          <Panel title="영상 구간" meta="학습 순서">
            <div className="chapter-list">
              {chapters.map((chapter) => (
                <div key={chapter.time} className="chapter-row">
                  <strong>{chapter.label}</strong>
                  <small>{chapter.time}</small>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="관련 노하우" meta="참고 문서">
            <BulletList items={(knowhow?.expert_tips || []).map((item) => item.tip || "").slice(0, 4)} empty="불러온 숙련공 팁이 없습니다." />
          </Panel>
        </div>
      </div>
    </section>
  );
}

function ChatPage({
  messages,
  input,
  loading,
  imageLoading,
  filters,
  chatLogHeight,
  onStartResize,
  onInput,
  onSubmit,
  onGenerateImage,
}: {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  imageLoading: boolean;
  filters: ContextFilters;
  chatLogHeight: number;
  onStartResize: (event: PointerEvent<HTMLDivElement>) => void;
  onInput: (value: string) => void;
  onSubmit: (event?: FormEvent, text?: string) => void;
  onGenerateImage: () => void;
}) {
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, loading, imageLoading]);

  return (
    <section className="chat-shell" style={{ "--chat-log-height": `${chatLogHeight}px` } as CSSProperties}>
      <div className="chat-context">
        <span className="chip">{MATERIAL_LABEL[filters.material]}</span>
        <span className="chip">{filters.position}</span>
        <span className="chip amber">{STAGE_LABEL[filters.stage]}</span>
        <span className="context-note">연결된 백엔드 노하우와 작업 영상을 근거로 답변합니다.</span>
      </div>

      <div className="chat-log">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        <div ref={endOfMessagesRef} />
        {loading && <span className="loading-line">숙련공 노하우를 찾는 중...</span>}
        {imageLoading && <span className="loading-line">이미지 생성 중...</span>}
      </div>

      <div className="chat-resizer" role="separator" aria-label="대화 영역 높이 조절" onPointerDown={onStartResize}>
        <span />
      </div>

      <div className="suggestion-row">
        {SAMPLE_PROMPTS.map((prompt) => (
          <button key={prompt} className="suggestion-chip" type="button" onClick={() => onSubmit(undefined, prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form className="chat-input" onSubmit={(event) => onSubmit(event)}>
        <textarea value={input} onChange={(event) => onInput(event.target.value)} placeholder="파이프 TIG 용접 기법, 결함, 전류 조건, 자세 노하우 또는 생성할 이미지 설명을 입력하세요." />
        <button className="send-button" type="submit" disabled={loading || imageLoading}>
          전송
        </button>
        <button className="image-button" type="button" onClick={onGenerateImage} disabled={loading || imageLoading || !input.trim()}>
          이미지 생성
        </button>
      </form>
    </section>
  );
}

function PhotoFeedbackPage({
  filters,
  file,
  preview,
  memo,
  uploadResult,
  feedback,
  loading,
  error,
  onMemo,
  onFile,
  onRun,
}: {
  filters: ContextFilters;
  file: File | null;
  preview: string;
  memo: string;
  uploadResult: UploadResponse | null;
  feedback: FeedbackResponse | null;
  loading: boolean;
  error: string;
  onMemo: (value: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onRun: () => void;
}) {
  return (
    <section className="page-stack">
      <SectionHeader
        title={PAGE_LABEL.feedback}
        body="작업 사진과 현재 재질/자세 정보를 함께 보내 결함 가능성과 교정 순서를 받습니다."
        right={<span className="chip amber">{MATERIAL_LABEL[filters.material]} / {filters.position}</span>}
      />
      <div className="feedback-layout">
        <Panel title="작업 사진" meta="업로드">
          <label className="upload-zone">
            <input accept="image/*" type="file" onChange={onFile} />
            <span className="upload-icon">+</span>
            <strong>{file ? file.name : "용접 사진 선택"}</strong>
            <small className="muted">JPG, PNG 또는 휴대폰 촬영 사진</small>
          </label>
          <TextArea label="현장 메모" value={memo} onChange={onMemo} />
          {error && <Callout tone="red" title="사진 필요" body={error} />}
          <button className="primary-button wide" type="button" onClick={onRun} disabled={loading}>
            {loading ? "분석 중..." : "피드백 받기"}
          </button>
        </Panel>

        <div className="result-zone">
          <div className="weld-preview">
            {preview ? (
              <div className="uploaded-preview" aria-label="Uploaded weld preview" style={{ backgroundImage: `url(${preview})` }} />
            ) : (
              <div className="video-missing"><span>업로드한 사진 미리보기가 여기에 표시됩니다.</span></div>
            )}
            {preview && (
              <>
                <div className="bbox bbox-red" style={{ left: "49%", top: "43%", width: "28%", height: "18%" }}>
                  <span>덜 채워짐 의심</span>
                </div>
                <div className="bbox bbox-amber" style={{ left: "24%", top: "54%", width: "22%", height: "15%" }}>
                  <span>입열 편차</span>
                </div>
              </>
            )}
          </div>
          <div className="result-grid">
            <Panel title="분류 결과" meta="사진 기준">
              <div className="classification-card">
                <span>재질</span>
                <strong>{uploadResult ? MATERIAL_LABEL[uploadResult.classification.material] : MATERIAL_LABEL[filters.material]}</strong>
                <span>자세</span>
                <strong>{uploadResult ? uploadResult.classification.position : filters.position}</strong>
                <ConfidenceRow label="신뢰도" value={Math.round((uploadResult?.classification.confidence || 0.72) * 100)} tone="cyan" />
              </div>
            </Panel>
            <Panel title="피드백 상태" meta="백엔드">
              <Callout
                tone={feedback ? "green" : "amber"}
                title={feedback ? "피드백 준비됨" : "분석 대기 중"}
                body={feedback ? feedback.feedback.summary : "사진을 올리고 피드백을 실행하면 교정 순서가 생성됩니다."}
              />
            </Panel>
          </div>
          {feedback && <FeedbackReport response={feedback} />}
        </div>
      </div>
    </section>
  );
}

function KnowledgeArchivePage({
  items,
  knowhow,
  loading,
  onOpen,
}: {
  items: ArchiveItem[];
  knowhow: KnowhowResponse | null;
  loading: boolean;
  onOpen: (item: ArchiveItem) => void;
}) {
  return (
    <section className="page-stack">
      <SectionHeader
        title={PAGE_LABEL.archive}
        body="챗봇과 사진 피드백이 참고하는 숙련공 노하우를 사람이 검수하기 쉬운 문서 카드로 정리합니다."
        right={<span className="chip">{loading ? "동기화 중" : `${items.length}개 문서`}</span>}
      />
      <div className="archive-toolbar">
        <div className="archive-purpose">
          <strong>이 페이지의 용도</strong>
          <p>영상, 표준 조건, 결함 대응, 자세 팁을 한 번에 확인하고 팀 공유 전에 내용이 맞는지 검수하는 공간입니다.</p>
        </div>
        <span className="chip green">{labelForMaterial(knowhow?.material)} / {knowhow?.position || "-"} 기준</span>
      </div>
      <div className="archive-list">
        {items.map((item) => (
          <button key={item.id} className="archive-card" type="button" onClick={() => onOpen(item)}>
            <span className={`type-chip ${item.type}`}>{archiveTypeLabel(item.type)}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <small>{MATERIAL_LABEL[item.material]} / {item.position} / {stageLabel(item.stage)} / {statusLabel(item.status)}</small>
          </button>
        ))}
      </div>
      {!items.length && <EmptyState title="노하우 문서 없음" body="현재 필터에 맞는 노하우가 없습니다." />}
    </section>
  );
}

function ArchiveDetailPage({
  item,
  knowhow,
  onBack,
  onAsk,
}: {
  item: ArchiveItem | null;
  knowhow: KnowhowResponse | null;
  onBack: () => void;
  onAsk: () => void;
}) {
  if (!item) return <EmptyState title="선택된 문서 없음" body="지식 아카이브에서 노하우 문서를 선택하세요." />;

  return (
    <section className="page-stack">
      <button className="link-button" type="button" onClick={onBack}>
        아카이브로 돌아가기
      </button>
      <div className="archive-detail">
        <div className="detail-main">
          <DocumentSheet item={item} />
          <button className="primary-button" type="button" onClick={onAsk}>
            이 문서로 챗봇에 질문하기
          </button>
        </div>
        <div className="side-stack">
          <Panel title="연결 영상" meta="근거 자료">
            {(knowhow?.citations || []).slice(0, 5).map((citation) => (
              <SourceRow key={citation.id} title={cleanTitle(citation.title)} meta={citation.id} />
            ))}
          </Panel>
          <Panel title="검수 상태" meta="품질 확인">
            <Checklist items={["필수 항목 입력", "영상 근거 연결", "검색 가능", "숙련공 최종 검토"]} doneCount={3} />
          </Panel>
        </div>
      </div>
    </section>
  );
}

function MasterInputPage({
  draft,
  sources,
  onUpdate,
  onSaved,
}: {
  draft: InputDraft;
  sources: SourceVideo[];
  onUpdate: <K extends keyof InputDraft>(key: K, value: InputDraft[K]) => void;
  onSaved: () => Promise<void>;
}) {
  const sourceOptions = (sources.length ? sources : FALLBACK_VIDEOS).map((item) => ({
    value: item.id,
    label: `${item.id} / ${cleanTitle(item.title)}`,
  }));
  const validations = [
    Boolean(draft.defect && draft.cause && draft.solution),
    Boolean(draft.current || draft.gas),
    Boolean(draft.source),
    false,
  ];
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [manualRagUpdate, setManualRagUpdate] = useState<RagUpdateResult | null>(null);
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadStatus, setFileUploadStatus] = useState("");
  const [fileUploadResult, setFileUploadResult] = useState<KnowledgeFileUploadResponse | null>(null);

  const runSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveStatus("");
    setManualRagUpdate(null);
    try {
      const result = await saveKnowledge({
        material: draft.material,
        position: draft.position,
        stage: draft.stage,
        knowledge_type: draft.knowledgeType,
        defect: draft.defect,
        cause: draft.cause,
        solution: draft.solution,
        expert_tip: draft.expertTip,
        current: draft.current,
        gas: draft.gas,
        source: draft.source,
      });
      setManualRagUpdate(result.rag_update || null);
      const countText = formatCountTransition(result.rag_update);
      setSaveStatus(`${MATERIAL_LABEL[draft.material]} ${draft.position} 노하우가 저장되었습니다.${countText ? ` ChromaDB ${countText}` : ""}`);
      await onSaved();
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const runKnowledgeFileUpload = async () => {
    if (!knowledgeFile || fileUploading) return;
    setFileUploading(true);
    setFileUploadStatus("");
    setFileUploadResult(null);
    try {
      const result = await uploadKnowledgeFile({
        file: knowledgeFile,
        material: draft.material,
        position: draft.position,
        stage: draft.stage,
        knowledge_type: draft.knowledgeType,
        source: draft.source,
      });
      setFileUploadResult(result);
      const countText = formatCountTransition(result);
      setFileUploadStatus(
        result.ok
          ? `파일 노하우 ${result.entries_added}개가 RAG DB에 반영되었습니다.${countText ? ` ChromaDB ${countText}` : ""}`
          : `파일은 저장됐지만 ChromaDB 재색인에 실패했습니다. ${result.error || "서버 로그를 확인해 주세요."}`,
      );
      await onSaved();
    } catch (error) {
      setFileUploadStatus(error instanceof Error ? error.message : "파일 업로드에 실패했습니다.");
    } finally {
      setFileUploading(false);
    }
  };

  return (
    <section className="page-stack">
      <SectionHeader
        title={PAGE_LABEL.input}
        body="숙련공의 현장 노하우를 일정한 형식으로 입력해 챗봇과 사진 피드백이 참고할 수 있는 자료로 저장합니다."
      />
      <div className="input-layout">
        <Panel title="숙련공 노하우 입력" meta="표준 입력">
          <div className="form-grid">
            <SelectField label="재질" value={draft.material} onChange={(value) => onUpdate("material", value as MaterialKey)} options={FALLBACK_MATERIALS.map((item) => ({ value: item, label: MATERIAL_LABEL[item] }))} />
            <SelectField label="자세" value={draft.position} onChange={(value) => onUpdate("position", value as Position)} options={FALLBACK_POSITIONS.map((item) => ({ value: item, label: item }))} />
            <SelectField label="작업 단계" value={draft.stage} onChange={(value) => onUpdate("stage", value as StageKey)} options={STAGE_OPTIONS.map((item) => ({ value: item, label: STAGE_LABEL[item] }))} />
          </div>
          <TextField label="결함명" value={draft.defect} onChange={(value) => onUpdate("defect", value)} />
          <TextArea label="원인 분석" value={draft.cause} onChange={(value) => onUpdate("cause", value)} />
          <TextArea label="교정 조치" value={draft.solution} onChange={(value) => onUpdate("solution", value)} />
          <TextArea label="숙련공 팁" value={draft.expertTip} onChange={(value) => onUpdate("expertTip", value)} />
          <div className="form-grid">
            <TextField label="전류" value={draft.current} onChange={(value) => onUpdate("current", value)} />
            <TextField label="가스 유량" value={draft.gas} onChange={(value) => onUpdate("gas", value)} />
            <TextField label="자료 유형" value={draft.knowledgeType} onChange={(value) => onUpdate("knowledgeType", value)} />
          </div>
          <SelectField label="근거 영상" value={draft.source} onChange={(value) => onUpdate("source", value)} options={sourceOptions} />
          <button className="primary-button wide" type="button" onClick={runSave} disabled={saving}>
            {saving ? "저장 중..." : "노하우 저장"}
          </button>
          {saveStatus && <Callout tone={saveStatus.includes("저장되었습니다") ? "green" : "red"} title="저장 상태" body={saveStatus} />}
          {manualRagUpdate && <RagUpdateLog result={manualRagUpdate} />}

          <div className="knowledge-file-panel">
            <div className="mini-section-heading">
              <strong>노하우 파일 업로드</strong>
              <span>.txt / .md / .pdf 파일을 문단 단위로 파싱해 RAG JSON과 ChromaDB에 반영합니다.</span>
            </div>
            <label className="knowledge-file-drop">
              <input
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setKnowledgeFile(event.target.files?.[0] || null);
                  setFileUploadStatus("");
                  setFileUploadResult(null);
                }}
              />
              <span className="upload-icon">+</span>
              <strong>{knowledgeFile ? knowledgeFile.name : "노하우 파일 선택"}</strong>
              <small>PDF는 page text를 추출하고, 선택한 재질/자세/공정 기준으로 expert_tip 청크가 생성됩니다.</small>
            </label>
            <button className="primary-button wide" type="button" onClick={runKnowledgeFileUpload} disabled={!knowledgeFile || fileUploading}>
              {fileUploading ? "RAG DB 업데이트 중..." : "파일 업로드 및 RAG DB 업데이트"}
            </button>
            {fileUploadStatus && (
              <Callout
                tone={fileUploadResult?.ok ? "green" : fileUploadResult ? "amber" : "red"}
                title="RAG DB 업데이트"
                body={fileUploadStatus}
              />
            )}
            {fileUploadResult && (
              <RagUpdateLog
                result={fileUploadResult}
                storedPath={fileUploadResult.stored_path}
                entriesAdded={fileUploadResult.entries_added}
                fileType={fileUploadResult.file_type}
                pagesExtracted={fileUploadResult.pages_extracted}
                preview={fileUploadResult.parsed_preview}
              />
            )}
          </div>
        </Panel>

        <div className="side-stack">
          <Panel title="저장 문서 미리보기" meta="검수용">
            <MasterPreview draft={draft} />
          </Panel>
          <Panel title="저장 전 확인" meta="품질 확인">
            <Checklist items={["필수 항목", "전류/가스 값", "근거 영상", "숙련공 검토"]} doneCount={validations.filter(Boolean).length} />
          </Panel>
        </div>
      </div>
    </section>
  );
}

function CommunityPage({ filters }: { filters: ContextFilters }) {
  const posts = [
    {
      category: "공지",
      title: "6G 루트패스 연습 전 확인할 공통 체크리스트",
      author: "교육 관리자",
      comments: 12,
      views: 284,
      time: "09:10",
      pinned: true,
    },
    {
      category: "질문",
      title: "스테인리스 6G 6시 구간에서 풀이 처질 때 전류를 얼마나 낮추나요?",
      author: "김민성",
      comments: 8,
      views: 147,
      time: "09:32",
      pinned: false,
    },
    {
      category: "노하우",
      title: "백퍼지 봉지 부풀림 상태로 누설 확인하는 방법",
      author: "박숙련",
      comments: 5,
      views: 116,
      time: "10:04",
      pinned: false,
    },
    {
      category: "후기",
      title: "사진 피드백 받고 언더컷 구간 재연습한 결과",
      author: "이현장",
      comments: 4,
      views: 92,
      time: "10:18",
      pinned: false,
    },
    {
      category: "자료공유",
      title: "탄소강 5G 핫패스 전류 조절표 공유",
      author: "정기술",
      comments: 3,
      views: 88,
      time: "10:41",
      pinned: false,
    },
    {
      category: "질문",
      title: "알루미늄 TIG에서 용융지가 흔들릴 때 진행 속도 기준이 궁금합니다",
      author: "신입01",
      comments: 6,
      views: 134,
      time: "11:05",
      pinned: false,
    },
    {
      category: "노하우",
      title: "낮은 자세에서 무릎 고정하고 토치각 유지하는 팁",
      author: "최마스터",
      comments: 9,
      views: 201,
      time: "11:20",
      pinned: false,
    },
    {
      category: "후기",
      title: "6G 높은 자세 전환 연습 3일차 기록",
      author: "윤훈련",
      comments: 2,
      views: 59,
      time: "12:12",
      pinned: false,
    },
    {
      category: "자료공유",
      title: "스테인리스 루트갭 2.4mm 세팅 사진 모음",
      author: "배관팀",
      comments: 7,
      views: 173,
      time: "13:03",
      pinned: false,
    },
    {
      category: "질문",
      title: "컵 워킹 중 와이어가 자꾸 붙을 때 손 위치를 어떻게 잡나요?",
      author: "문작업",
      comments: 11,
      views: 226,
      time: "13:47",
      pinned: false,
    },
    {
      category: "노하우",
      title: "아크 길이 짧게 유지하는 시선 기준",
      author: "강용접",
      comments: 4,
      views: 101,
      time: "14:26",
      pinned: false,
    },
    {
      category: "후기",
      title: "영상 보면서 루트패스 리듬 맞춘 뒤 백비드 변화",
      author: "오실습",
      comments: 6,
      views: 122,
      time: "15:08",
      pinned: false,
    },
  ];
  const categories = ["전체", "공지", "질문", "노하우", "후기", "자료공유"];
  const hotPosts = posts.filter((post) => post.views > 140).slice(0, 5);

  return (
    <section className="page-stack community-page">
      <div className="community-hero">
        <div>
          <span className="eyebrow">마스터-카피 카페</span>
          <h2>{PAGE_LABEL.community}</h2>
          <p>작업 질문, 숙련공 답변, 재연습 후기와 자료를 모아 보는 팀 게시판입니다.</p>
        </div>
        <div className="community-profile">
          <span className="chip green">{MATERIAL_LABEL[filters.material]} / {filters.position}</span>
          <strong>멤버 128</strong>
          <small>오늘 글 12 · 댓글 64</small>
        </div>
      </div>

      <div className="community-board-shell">
        <div className="community-main-board">
          <div className="community-board-toolbar">
            <div className="community-tabs">
              {categories.map((category) => (
                <button key={category} className={category === "전체" ? "active" : ""} type="button">
                  {category}
                </button>
              ))}
            </div>
            <div className="community-search">
              <input aria-label="게시글 검색" placeholder="게시글 검색" />
              <button className="secondary-button" type="button">검색</button>
              <button className="primary-button" type="button">글쓰기</button>
            </div>
          </div>

          <div className="community-list-head" aria-hidden="true">
            <span>분류</span>
            <span>제목</span>
            <span>작성자</span>
            <span>조회</span>
            <span>시간</span>
          </div>
          <div className="community-post-list">
            {posts.map((post) => (
              <button key={post.title} className={post.pinned ? "community-post pinned" : "community-post"} type="button">
                <span className={post.category === "공지" ? "post-badge notice" : "post-badge"}>{post.category}</span>
                <strong>
                  {post.title}
                  <small>{post.comments}</small>
                </strong>
                <span>{post.author}</span>
                <span>{post.views}</span>
                <span>{post.time}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="community-side-panel">
          <section>
            <strong>인기글</strong>
            {hotPosts.map((post, index) => (
              <button key={post.title} type="button">
                <span>{index + 1}</span>
                <em>{post.title}</em>
              </button>
            ))}
          </section>
          <section>
            <strong>최신 댓글</strong>
            <p>“백퍼지 누설 먼저 확인해보세요.”</p>
            <p>“전류보다 진행 속도 일정한지 먼저 봐야 합니다.”</p>
            <p>“영상 1분 20초 구간 자세가 참고됩니다.”</p>
          </section>
          <section className="community-mock-note">
            <strong>목업 안내</strong>
            <p>게시글 저장과 댓글 작성은 후속 백엔드 연동 단계에서 연결합니다.</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

function InsightDrawer({
  page,
  filters,
  videos,
  citations,
  knowhow,
  photoFeedback,
}: {
  page: PageKey;
  filters: ContextFilters;
  videos: TrainingVideo[];
  citations: Array<{ id: string; title: string }>;
  knowhow: KnowhowResponse | null;
  photoFeedback: FeedbackResponse | null;
}) {
  return (
    <aside className="insight-drawer">
      <div className="drawer-head">
        <span>요약 패널</span>
        <strong>{pageTitle(page)}</strong>
      </div>
      <div className="drawer-section">
        <span className="drawer-label">현재 기준</span>
        <div className="drawer-chip-row">
          <span className="chip">{MATERIAL_LABEL[filters.material]}</span>
          <span className="chip">{filters.position}</span>
          <span className="chip amber">{STAGE_LABEL[filters.stage]}</span>
        </div>
      </div>
      <div className="drawer-section">
        <span className="drawer-label">추천 영상</span>
        {videos.slice(0, 3).map((video) => (
          <SourceRow key={video.id} title={cleanTitle(video.title)} meta={`${video.id} / ${video.position || "-"}`} />
        ))}
        {!videos.length && <small className="muted">현재 필터에 맞는 영상이 없습니다.</small>}
      </div>
      <div className="drawer-section">
        <span className="drawer-label">근거 자료</span>
        {citations.slice(0, 4).map((item) => (
          <SourceRow key={item.id} title={cleanTitle(item.title)} meta={item.id} />
        ))}
        {!citations.length && <small className="muted">챗봇 답변 후 근거 자료가 표시됩니다.</small>}
      </div>
      <div className="drawer-section">
        <span className="drawer-label">노하우 요약</span>
        <div className="drawer-stat">
          <span>팁</span><strong>{knowhow?.expert_tips?.length || 0}</strong>
          <span>결함</span><strong>{knowhow?.defect_solutions?.length || 0}</strong>
          <span>문답</span><strong>{knowhow?.qa?.length || 0}</strong>
        </div>
      </div>
      {photoFeedback && (
        <div className="drawer-section">
          <span className="drawer-label">최근 사진 피드백</span>
          <p className="drawer-summary">{photoFeedback.feedback.summary}</p>
        </div>
      )}
    </aside>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="chat-bubble user">
        <p>{message.content}</p>
        <small>{message.createdAt}</small>
      </div>
    );
  }

  return (
    <div className="chat-bubble assistant">
      <div className="assistant-header">
        <span className="chip green">마스터 AI</span>
        <small>{message.createdAt}</small>
      </div>
      {message.image ? (
        <ImageAnswer image={message.image} />
      ) : message.answer ? (
        <ChatAnswer answer={message.answer} />
      ) : message.response ? (
        <FeedbackAnswer response={message.response} />
      ) : (
        <div className="answer-summary">
          <FormattedAnswer value={message.content} />
        </div>
      )}
    </div>
  );
}

function sanitizeAssistantAnswer(value: string) {
  return value
    .replace(/^\s*(?:근거|출처):\s*\[[^\]]+\]\s*$/gim, "")
    .replace(/^\s*관련 근거가 필요하면 아래 근거 자료\/추천 영상에서 확인할 수 있습니다\.?\s*$/gim, "")
    .replace(/\s*\[(?:\d+|source\s*\d+)\]/gi, "")
    .replace(/\[(?:stainless|carbon_steel|aluminum|posture)_[^\]]+?\]/gi, "")
    .replace(/```+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inlineMarkdown(text: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const value = match[2] || match[3] || match[4] || "";
    nodes.push(match[4]
      ? <code key={`${match.index}-code`}>{value}</code>
      : <strong key={`${match.index}-strong`}>{value}</strong>);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function FormattedAnswer({ value }: { value: string }) {
  const lines = sanitizeAssistantAnswer(value).split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let orderedItems: string[] = [];
  let bulletItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`}>{inlineMarkdown(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushOrdered = () => {
    if (!orderedItems.length) return;
    blocks.push(
      <ol key={`ol-${blocks.length}`}>
        {orderedItems.map((item, index) => <li key={`${index}-${item}`}>{inlineMarkdown(item)}</li>)}
      </ol>,
    );
    orderedItems = [];
  };
  const flushBullets = () => {
    if (!bulletItems.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {bulletItems.map((item, index) => <li key={`${index}-${item}`}>{inlineMarkdown(item)}</li>)}
      </ul>,
    );
    bulletItems = [];
  };
  const flushLists = () => {
    flushOrdered();
    flushBullets();
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushLists();
      return;
    }

    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushLists();
      blocks.push(<h4 key={`h-${blocks.length}`}>{inlineMarkdown(heading[1])}</h4>);
      return;
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushBullets();
      orderedItems.push(ordered[1]);
      return;
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushOrdered();
      bulletItems.push(bullet[1]);
      return;
    }

    flushLists();
    paragraph.push(line);
  });

  flushParagraph();
  flushLists();

  return <div className="formatted-answer">{blocks.length ? blocks : <p>{value}</p>}</div>;
}

function ChatAnswer({ answer }: { answer: AnswerResponse }) {
  const routing = answer.routing;
  const hitItems = (answer.hits || [])
    .slice(0, 3)
    .map(formatHitForDisplay);
  const videoItems = (answer.citations || [])
    .slice(0, 4)
    .map((item) => `${item.video_available ? "재생 가능" : "파일 미연결"} · ${cleanTitle(item.title)}`);
  const sourceItems = (answer.citations || [])
    .slice(0, 4)
    .map((item) => `${cleanTitle(item.title)}${item.video ? ` · ${item.video}` : ""}`);

  return (
    <div className="feedback-answer">
      <div className="answer-summary">
        <FormattedAnswer value={answer.answer} />
      </div>
      <div className="chat-route-row">
        <span className="chip green">근거 답변</span>
        {routing?.material && <span className="chip">{labelForMaterial(routing.material)}</span>}
        {routing?.position && <span className="chip">{routing.position}</span>}
        {routing?.reason && <span className="context-note">{routing.reason}</span>}
      </div>
      <details className="answer-evidence">
        <summary>근거 노하우와 연결 영상 보기</summary>
        <div className="answer-grid">
          <AnswerBlock title="참고한 노하우" items={hitItems} />
          <AnswerBlock title="연결된 작업 영상" items={videoItems} tone="green" />
          <AnswerBlock title="출처 정보" items={sourceItems} tone="amber" />
        </div>
      </details>
    </div>
  );
}

function ImageAnswer({ image }: { image: ImageResponse }) {
  return (
    <div className="generated-image-card">
      <div className="generated-image-copy">
        <strong>{image.text || "요청하신 이미지를 생성했습니다."}</strong>
        <span>{image.provider || "gemini"} / {image.model}</span>
      </div>
      <img src={image.data_url} alt={image.prompt} />
      <p>{image.prompt}</p>
    </div>
  );
}

function FeedbackAnswer({ response }: { response: FeedbackResponse }) {
  return (
    <div className="feedback-answer">
      <h3>{response.feedback.summary}</h3>
      <div className="answer-grid">
        <AnswerBlock title="핵심 점검" items={response.feedback.key_points} />
        <AnswerBlock title="주의할 점" items={response.feedback.warnings} tone="amber" />
        <AnswerBlock title="다음 조치" items={response.feedback.next_steps} tone="green" />
      </div>
      <div className="source-list-inline">
        {(response.citations || []).slice(0, 3).map((item) => (
          <span key={item.id}>{item.video_available ? "재생 가능" : "파일 미연결"} / {cleanTitle(item.title)}</span>
        ))}
        {response.llm?.vision && <span>Vertex 이미지 분석</span>}
        {response.llm?.dry_run && <span>로컬 대체 응답</span>}
      </div>
    </div>
  );
}

function FeedbackReport({ response }: { response: FeedbackResponse }) {
  return (
    <Panel title="피드백 보고서" meta="조치 제안">
      <div className="report-grid">
        <div>
          <h3>{response.feedback.summary}</h3>
          <AnswerBlock title="진단" items={response.feedback.key_points} />
        </div>
        <div>
          <AnswerBlock title="위험 요소" items={response.feedback.warnings} tone="amber" />
          <AnswerBlock title="교정 순서" items={response.feedback.next_steps} tone="green" />
        </div>
      </div>
      <div className="source-list-inline">
        {(response.training_videos || []).slice(0, 4).map((video) => (
          <span key={video.id}>{video.video_available ? "재생 가능" : "파일 미연결"} / {cleanTitle(video.title)}</span>
        ))}
        {response.llm?.vision && <span>이미지+노하우 LLM 분석</span>}
        {response.llm?.dry_run && <span>로컬 대체 응답</span>}
      </div>
    </Panel>
  );
}

function VideoCard({ video, onOpen }: { video: TrainingVideo; onOpen: (video: TrainingVideo) => void }) {
  const playbackUrl = getVideoPlaybackUrl(video);
  const previewUrl = getVideoPreviewUrl(video);

  return (
    <button type="button" className={`video-card ${playbackUrl ? "is-ready" : "is-missing"}`} onClick={() => onOpen(video)}>
      <div className="video-thumb">
        {previewUrl ? (
          <video className="video-thumb-preview" src={previewUrl} muted playsInline preload="metadata" aria-hidden="true" />
        ) : (
          <div className="synthetic-spark" />
        )}
        <span className="play-mark">{playbackUrl ? "재생" : "미연결"}</span>
        <small>{video.position || "공통"}</small>
      </div>
      <div className="video-card-copy">
        <strong>{cleanTitle(video.title)}</strong>
        <span>{labelForMaterial(video.material)} / {video.id}</span>
        <small className={playbackUrl ? "ready-label" : "missing-label"}>{playbackUrl ? "영상 준비됨" : "정보만 있음 / 파일 미연결"}</small>
      </div>
    </button>
  );
}

function MissionCard({ glyph, title, body, onClick }: { glyph: string; title: string; body: string; onClick: () => void }) {
  return (
    <button className="mission-card" type="button" onClick={onClick}>
      <span>{glyph}</span>
      <strong>{title}</strong>
      <small>{body}</small>
    </button>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "cyan" | "green" | "amber" }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function Panel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <header>
        <strong>{title}</strong>
        {meta && <span>{meta}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function SectionHeader({ title, body, right }: { title: string; body: string; right?: ReactNode }) {
  return (
    <div className="section-header">
      <div>
        <span className="eyebrow">마스터-카피</span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {right}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function Callout({ title, body, tone = "cyan" }: { title: string; body: string; tone?: "cyan" | "amber" | "green" | "red" }) {
  return (
    <div className={`callout ${tone}`}>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function formatCountTransition(result?: RagUpdateResult | null) {
  if (!result) return "";
  const before = result.collection_count_before;
  const after = result.collection_count_after;
  if (before === null || after === null) return "";
  return `${before} → ${after}`;
}

function RagUpdateLog({
  result,
  storedPath,
  entriesAdded,
  fileType,
  pagesExtracted,
  preview,
}: {
  result: RagUpdateResult;
  storedPath?: string;
  entriesAdded?: number;
  fileType?: string;
  pagesExtracted?: number;
  preview?: Array<{ page?: number | null; text: string }>;
}) {
  const countText = formatCountTransition(result);
  const rows = [
    storedPath ? `파일 저장: ${storedPath}` : "",
    fileType ? `파일 유형: ${fileType.toUpperCase()}` : "",
    pagesExtracted ? `PDF 파싱 페이지: ${pagesExtracted} pages` : "",
    typeof entriesAdded === "number" ? `문단 chunk 생성: ${entriesAdded}개` : "",
    `컬렉션: ${result.collection}`,
    countText ? `ChromaDB count: ${countText}` : "ChromaDB count: 확인 불가",
    result.ok ? "재색인 상태: 완료" : `재색인 상태: 실패${result.error ? ` (${result.error})` : ""}`,
    ...(result.rebuild_logs || []).slice(0, 5),
  ].filter(Boolean);

  return (
    <div className={`rag-update-log ${result.ok ? "ok" : "warn"}`}>
      <strong>RAG 처리 로그</strong>
      <ul>
        {rows.map((row, index) => (
          <li key={`${row}-${index}`}>{row}</li>
        ))}
      </ul>
      {preview?.length ? (
        <div className="rag-preview-list">
          <strong>파싱 chunk 미리보기</strong>
          {preview.map((item, index) => (
            <p key={`${item.page || "text"}-${index}`}>
              <span>{item.page ? `p.${item.page}` : `#${index + 1}`}</span>
              {cleanBodyText(item.text)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SourceRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="source-row">
      <span>근거</span>
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
    </div>
  );
}

function DocumentSheet({ item }: { item: ArchiveItem }) {
  const rows = documentRows(item);

  return (
    <article className="document-sheet">
      <div className="document-topline">
        <span className={`type-chip ${item.type}`}>{archiveTypeLabel(item.type)}</span>
        <small>{statusLabel(item.status)}</small>
      </div>
      <h2>{item.title}</h2>
      <div className="document-meta-grid">
        <span>재질</span><strong>{MATERIAL_LABEL[item.material]}</strong>
        <span>자세</span><strong>{item.position}</strong>
        <span>공정</span><strong>{stageLabel(item.stage)}</strong>
        <span>근거 영상</span><strong>{item.sourceIds.length ? `${item.sourceIds.length}개 연결` : "미연결"}</strong>
      </div>
      <div className="document-section">
        <strong>현장 적용 내용</strong>
        {rows.length ? (
          <ul className="document-list">
            {rows.map((row, index) => (
              <li key={`${row}-${index}`}>{row}</li>
            ))}
          </ul>
        ) : (
          <p>{item.body}</p>
        )}
      </div>
      <div className="document-note">
        <strong>활용 방법</strong>
        <p>이 문서는 챗봇 답변과 사진 피드백의 근거로 사용됩니다. 내용이 현장 기준과 다르면 숙련공 입력 화면에서 수정해 다시 저장하세요.</p>
      </div>
    </article>
  );
}

function MasterPreview({ draft }: { draft: InputDraft }) {
  const rows = [
    draft.defect && `결함명: ${draft.defect}`,
    draft.cause && `원인: ${draft.cause}`,
    draft.solution && `조치: ${draft.solution}`,
    draft.expertTip && `숙련공 팁: ${draft.expertTip}`,
    (draft.current || draft.gas) && `조건: 전류 ${draft.current || "-"} / 가스 ${draft.gas || "-"}`,
    draft.source && `근거 영상: ${draft.source}`,
  ].filter(Boolean) as string[];

  return (
    <article className="document-sheet compact">
      <div className="document-topline">
        <span className="type-chip defect">저장 예정</span>
        <small>{MATERIAL_LABEL[draft.material]} / {draft.position}</small>
      </div>
      <h3>{draft.defect || "새 노하우 문서"}</h3>
      <div className="document-meta-grid">
        <span>재질</span><strong>{MATERIAL_LABEL[draft.material]}</strong>
        <span>자세</span><strong>{draft.position}</strong>
        <span>공정</span><strong>{STAGE_LABEL[draft.stage]}</strong>
        <span>자료 유형</span><strong>{knowledgeTypeLabel(draft.knowledgeType)}</strong>
      </div>
      <div className="document-section">
        <strong>입력 내용</strong>
        <BulletList items={rows} empty="왼쪽 입력란을 작성하면 문서 형태로 미리보기가 표시됩니다." />
      </div>
    </article>
  );
}

function AnswerBlock({ title, items, tone = "cyan" }: { title: string; items: string[]; tone?: "cyan" | "amber" | "green" }) {
  return (
    <div className={`answer-block ${tone}`}>
      <strong>{title}</strong>
      <BulletList items={items} empty="표시할 항목이 없습니다." />
    </div>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="bullet-list">
      {filtered.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function Checklist({ items, doneCount }: { items: string[]; doneCount: number }) {
  return (
    <div className="check-list">
      {items.map((item, index) => (
        <div key={item} className={index < doneCount ? "done" : ""}>
          <span>{index < doneCount ? "확인" : "!"}</span>
          <strong>{item}</strong>
        </div>
      ))}
    </div>
  );
}

function ConfidenceRow({ label, value, tone }: { label: string; value: number; tone: "cyan" | "amber" | "red" }) {
  return (
    <div className="confidence-row">
      <span>{label}</span>
      <i><b className={tone} style={{ width: `${value}%` }} /></i>
      <small>{value}%</small>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function fallbackVideos(filters: ContextFilters): TrainingVideo[] {
  const exact = FALLBACK_VIDEOS.filter((video) => video.material === filters.material && video.position === filters.position);
  return exact.length ? exact : FALLBACK_VIDEOS.filter((video) => video.material === filters.material || video.position === filters.position);
}

function fallbackKnowhow(filters: ContextFilters): KnowhowResponse {
  return {
    ...FALLBACK_KNOWHOW,
    material: filters.material,
    position: filters.position,
    citations: fallbackVideos(filters).slice(0, 2).map((video) => ({
      id: video.id,
      title: video.title,
      material: video.material,
      position: video.position,
      video: video.video,
      video_url: video.video_url,
      video_available: video.video_available,
    })),
  };
}

function fallbackAnswer(filters: ContextFilters, query: string, knowhow: KnowhowResponse | null): AnswerResponse {
  const tips = knowhow?.expert_tips || [];
  const defects = knowhow?.defect_solutions || [];
  const citations = knowhow?.citations || [];
  const firstDefect = defects[0];
  const firstTip = tips[0]?.tip;

  return {
    answer: [
      `백엔드 챗봇 API가 연결되지 않아 ${MATERIAL_LABEL[filters.material]} ${filters.position} 기준의 로컬 대체 답변을 표시합니다.`,
      firstDefect ? `우선 확인할 결함: ${firstDefect.defect}. ${firstDefect.solution}` : "",
      firstTip ? `숙련공 팁: ${firstTip}` : "",
    ].filter(Boolean).join(" "),
    routing: {
      material: filters.material,
      position: filters.position,
      reason: `/api/answer 연결 실패로 로컬 대체 답변 사용; 질문=${query.slice(0, 80)}`,
    },
    citations,
    hits: [
      ...tips.slice(0, 2).map((item, index) => ({
        id: `fallback-tip-${index}`,
        material: filters.material,
        position: filters.position,
        type: "expert_tip",
        stage: item.stage,
        text: item.tip,
        source_ids: citations.map((citation) => citation.id),
      })),
      ...defects.slice(0, 2).map((item, index) => ({
        id: `fallback-defect-${index}`,
        material: filters.material,
        position: filters.position,
        type: "defect_solution",
        defect: item.defect,
        text: [item.cause, item.solution].filter(Boolean).join(" / "),
        source_ids: citations.map((citation) => citation.id),
      })),
    ],
    citations_markdown: citations.map((citation) => `${citation.id}: ${citation.title}`).join("\n"),
  };
}

function fallbackFeedback(filters: ContextFilters, observation: string, knowhow: KnowhowResponse | null): FeedbackResponse {
  const primaryDefect = knowhow?.defect_solutions?.[0];
  const primaryTip = knowhow?.expert_tips?.[0]?.tip;
  return {
    classification: {
      material: filters.material,
      position: filters.position,
    },
    observation,
    feedback: {
      summary: `Likely ${primaryDefect?.defect || "bead stability"} issue in ${MATERIAL_LABEL[filters.material]} ${filters.position}.`,
      key_points: [
        primaryDefect?.cause || "먼저 입열, 아크 길이, 용가재 투입 타이밍을 확인하세요.",
        primaryTip || "여러 조건을 동시에 바꾸기 전에 현재 비드를 연결 영상과 비교하세요.",
      ],
      warnings: [
        "진행 속도와 전류를 동시에 크게 올리지 마세요.",
        "기량 문제로 단정하기 전에 실드가스와 개선부 청결 상태를 확인하세요.",
      ],
      next_steps: [
        primaryDefect?.solution || "입열을 조금 낮추고 아크를 짧게 유지한 뒤 짧은 구간으로 재시도하세요.",
        "결함이 반복되면 해당 공정 체크리스트를 챗봇에 다시 질문하세요.",
      ],
    },
    citations: knowhow?.citations || [],
    training_videos: fallbackVideos(filters),
    llm: {
      provider: "local-demo",
      model: "fallback",
      dry_run: true,
      reason: "일시적으로 기본 노하우 답변을 사용했습니다.",
    },
  };
}

function knowhowToArchiveItems(knowhow: KnowhowResponse | null): ArchiveItem[] {
  if (!knowhow) return [];
  const sourceIds = (knowhow.citations || []).map((item) => item.id);
  const items: ArchiveItem[] = [];

  if (knowhow.parameters) {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-params`,
      type: "parameters",
      title: "표준 작업 조건",
      body: formatParameterLines(knowhow.parameters).join(" / "),
      material: knowhow.material,
      position: knowhow.position,
      status: "indexed",
      sourceIds,
    });
  }

  (knowhow.expert_tips || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-tip-${index}`,
      type: "tip",
      title: item.stage ? `${stageLabel(item.stage)} 숙련공 팁` : "숙련공 팁",
      body: item.tip || "",
      material: knowhow.material,
      position: knowhow.position,
      stage: item.stage,
      status: "indexed",
      sourceIds,
    });
  });

  (knowhow.defect_solutions || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-defect-${index}`,
      type: "defect",
      title: item.defect || "결함 대응",
      body: [item.cause && `원인: ${item.cause}`, item.solution && `조치: ${item.solution}`].filter(Boolean).join(" / "),
      material: knowhow.material,
      position: knowhow.position,
      status: "reviewed",
      sourceIds,
    });
  });

  (knowhow.qa || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-qa-${index}`,
      type: "qa",
      title: item.question || "질문 답변",
      body: item.answer || "",
      material: knowhow.material,
      position: knowhow.position,
      status: "reviewed",
      sourceIds,
    });
  });

  (knowhow.guide_sections || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-guide-${index}`,
      type: "guide",
      title: item.title || "작업 기준서",
      body: item.body || "",
      material: knowhow.material,
      position: knowhow.position,
      status: "indexed",
      sourceIds,
    });
  });

  (knowhow.posture_notes || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-posture-${index}`,
      type: "posture",
      title: item.subtopic || item.defect || "자세 노하우",
      body: item.tip || item.solution || item.question || item.cause || "",
      material: knowhow.material,
      position: knowhow.position,
      status: "indexed",
      sourceIds,
    });
  });

  return items;
}

function formatHitForDisplay(hit: AnswerHit) {
  const parts = [
    typeLabel(hit.type),
    stageLabel(hit.stage),
    hit.defect ? `결함: ${hit.defect}` : "",
  ].filter(Boolean);
  const prefix = parts.length ? `[${parts.join(" · ")}] ` : "";
  return `${prefix}${cleanBodyText(hit.text || "")}`;
}

function documentRows(item: ArchiveItem) {
  if (item.type === "parameters") {
    return item.body.split(" / ").map((row) => row.trim()).filter(Boolean);
  }

  if (item.type === "defect") {
    return item.body.split(" / ").map((row) => row.trim()).filter(Boolean);
  }

  if (item.type === "qa") {
    return [`답변: ${cleanBodyText(item.body)}`];
  }

  return [cleanBodyText(item.body)].filter(Boolean);
}

function formatParameterLines(parameters: Record<string, unknown>) {
  return Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim())
    .map(([key, value]) => `${parameterLabel(key)}: ${formatParameterValue(value)}`);
}

function formatParameterValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${parameterLabel(key)} ${nestedValue}`)
      .join(", ");
  }
  return String(value);
}

function parameterLabel(key: string) {
  const map: Record<string, string> = {
    tungsten: "텅스텐",
    filler: "용가재",
    filler_rod: "용가재",
    shielding_gas: "실드가스",
    backing_gas: "백퍼지 가스",
    polarity: "극성",
    root_pass_amp: "루트패스 전류",
    fill_cap_amp: "필/캡 전류",
    interpass_temp_max: "인터패스 최고 온도",
    technique: "운봉",
    root_gap: "루트 간격",
    land: "랜드",
    current: "전류",
    current_range: "전류 범위",
    gas: "가스",
    gas_flow: "가스 유량",
  };
  return map[key] || key.replace(/_/g, " ");
}

function cleanBodyText(value: string) {
  return value
    .replace(/\bCause:/g, "원인:")
    .replace(/\bSolution:/g, "조치:")
    .replace(/\bCurrent\b/g, "전류")
    .replace(/\bGas\b/g, "가스")
    .replace(/\bTip\b/g, "팁")
    .replace(/\s+/g, " ")
    .trim();
}

function typeLabel(type?: string) {
  const normalized = (type || "").toLowerCase();
  const map: Record<string, string> = {
    tip: "숙련공 팁",
    expert_tip: "숙련공 팁",
    defect: "결함 대응",
    defect_solution: "결함 대응",
    qa: "질문 답변",
    qna: "질문 답변",
    guide: "작업 기준서",
    doc_section: "작업 기준서",
    posture: "자세 노하우",
    parameters: "표준 조건",
    parameter: "표준 조건",
  };
  return map[normalized] || normalized.replace(/_/g, " ");
}

function stageLabel(stage?: string) {
  if (!stage) return "공통";
  return STAGE_LABEL[stage as StageKey] || stage.replace(/_/g, " ");
}

function knowledgeTypeLabel(type: string) {
  return typeLabel(type) || "노하우";
}

function pageTitle(page: PageKey) {
  return PAGE_LABEL[page];
}

function archiveTypeLabel(type: ArchiveItem["type"]) {
  const map: Record<ArchiveItem["type"], string> = {
    tip: "팁",
    defect: "결함",
    qa: "문답",
    guide: "기준서",
    posture: "자세",
    parameters: "조건",
  };
  return map[type];
}

function statusLabel(status: ArchiveItem["status"]) {
  const map: Record<ArchiveItem["status"], string> = {
    indexed: "검색 가능",
    reviewed: "검토됨",
    draft: "작성 중",
    "needs-source": "근거 필요",
  };
  return map[status];
}

function labelForMaterial(material?: MaterialKey | "") {
  return material ? MATERIAL_LABEL[material] : "common";
}

function cleanTitle(title?: string) {
  if (!title) return "Untitled";
  return title.replace(/\s+/g, " ").trim();
}

function formatTime() {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

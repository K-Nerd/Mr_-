import Link from "next/link";

const MAIN_LINKS = [
  {
    href: "/knowhow-upload",
    label: "숙련공 노하우 업로드",
    meta: "현장 팁과 결함 대응 등록",
    icon: "/images/operative_network_clean.png",
  },
  {
    href: "/videos",
    label: "작업 영상",
    meta: "재질/자세별 훈련 영상",
    icon: "/images/video_training_clean.png",
  },
  {
    href: "/chat",
    label: "노하우 챗봇",
    meta: "Gemini 기반 용접 질의응답",
    icon: "/images/master_chatbot_clean.png",
  },
  {
    href: "/feedback",
    label: "사진 피드백",
    meta: "작업 사진 분석과 교정 방향",
    icon: "/images/ai_inspection_clean.png",
  },
  {
    href: "/community",
    label: "커뮤니티",
    meta: "팀 공유와 질문 게시판",
    icon: "/images/community_clean.png",
    iconClass: "community",
  },
];

export default function MainPage() {
  return (
    <main className="main-landing">
      <div className="main-landing-overlay" />
      <section className="main-landing-content" aria-label="마스터 카피 메인 메뉴">
        <div className="main-landing-copy">
          <span>MASTER-COPY</span>
          <h1>파이프 TIG 용접 훈련 허브</h1>
          <p>숙련공 노하우, 작업 영상, AI 피드백을 실제 작업 흐름에 맞춰 바로 이동합니다.</p>
        </div>
        <nav className="main-entry-grid" aria-label="주요 기능 바로가기">
          {MAIN_LINKS.map((item) => (
            <Link key={item.href} className="main-entry-card" href={item.href}>
              <span className={item.iconClass ? `main-entry-icon ${item.iconClass}` : "main-entry-icon"} aria-hidden="true">
                <img src={item.icon} alt="" />
              </span>
              <span className="main-entry-copy">
                <strong>{item.label}</strong>
                <small>{item.meta}</small>
              </span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}

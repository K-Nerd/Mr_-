# GitHub 업로드 안내

이 폴더는 현재 구현 화면과 실행 코드를 유지하면서 GitHub 업로드용으로 정리한 버전입니다.

## 포함한 것

- Next.js 프론트엔드 화면과 라우팅 구조
- FastAPI 백엔드와 RAG/ChromaDB 파이프라인
- 메인 화면 배경, 아이콘, 커뮤니티/대시보드/챗봇/업로드 UI 자산
- RAG JSON 데이터, 로컬 ChromaDB sqlite 파일
- PDF 업로드 시연용 더미 문서
- 실행 스크립트와 팀원 실행 가이드

## 제외한 것

- `.git`, `.env`, 개인 API 키
- `node_modules`, `.next`, `.pip-cache`, `__pycache__` 같은 생성/캐시 파일
- 업로드 임시 파일과 개발 로그
- MP4 원본 영상 파일

## 영상 파일 안내

작업 영상 MP4는 GitHub 용량 제한 때문에 제외했습니다. 특히 원본 중 하나는 320MB라 일반 GitHub push가 실패합니다.

영상까지 동일하게 재생하려면 별도 공유 드라이브, Release, Git LFS 등을 사용해 MP4를 받은 뒤 아래 폴더에 넣으면 됩니다.

```text
apps/api/dataset/video/
```

파일명은 `apps/api/dataset/sources.json`의 `video` 경로와 일치해야 합니다.

## 환경 변수 안내

실제 API 키는 커밋하지 않습니다.

백엔드는 `apps/api/rag_pipeline/.env.example`을 `.env`로 복사한 뒤 `GEMINI_API_KEY` 등을 입력해서 실행합니다.

프론트엔드는 `apps/web/.env.example`을 참고하면 됩니다.

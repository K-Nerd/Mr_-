# 작업 영상 파일 안내

이 폴더에는 원래 작업 영상 MP4가 들어갑니다. GitHub 업로드용 버전에서는 대용량 파일을 제외했습니다.

## 왜 제외했나요?

- 일부 MP4가 100MB에 가깝고, 하나는 320MB라 GitHub 일반 push 제한에 걸립니다.
- 저장소에는 영상 메타데이터와 UI/재생 코드만 포함했습니다.

## 같은 화면으로 재생하려면

별도 공유 드라이브나 Git LFS로 MP4를 받은 뒤 이 폴더에 넣으세요.

예시:

```text
apps/api/dataset/video/stainless steel 6G pipe TIG welding.mp4
apps/api/dataset/video/local-stainless-welding.mp4
apps/api/dataset/video/local-carbon-steel-welding.mp4
apps/api/dataset/video/local-aluminum-welding2.mp4
```

파일명은 `apps/api/dataset/sources.json`의 `video` 값과 정확히 일치해야 합니다.

MP4가 없어도 RAG, 챗봇, 파일 업로드, ChromaDB 구축 기능은 동작합니다. 다만 영상 카드에는 `파일 미연결` 상태가 표시됩니다.

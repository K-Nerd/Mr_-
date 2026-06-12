# Team Handoff

## What Was Implemented

- Built the final Next.js web app inside `apps/web`.
- Connected UI flows to the copied FastAPI backend contract through `lib/api.ts`.
- Connected chatbot UI to `POST /api/answer`.
- Connected photo feedback UI to `POST /api/upload` and `POST /api/feedback`; uploaded image IDs are passed into the feedback call for Vertex/Gemini image+RAG analysis.
- Connected video list/detail UI to `GET /api/sources`, `GET /api/training-videos`, and `GET /api/video/{source_id}`.
- Added video upload/mapping flow through `POST /api/videos/upload`.
- Added master knowhow save flow through `POST /api/knowledge`.
- Added `video_available` mapping so missing mp4 files are shown clearly instead of silently failing.
- Added demo fallback data so the frontend still works when the backend is offline.
- Preserved Stitch and Claude design references under `reference_designs/민성_FE`.
- Preserved backend materials under `apps/api`.

## Implemented Pages

- Dashboard: system overview, matched videos, RAG chunk count, quick actions
- Training videos: filtered video cards and detail player layout
- Knowhow chatbot: RAG answer flow with citations and fallback responses
- Photo feedback: image upload preview, classification panel, corrective feedback report
- Knowledge archive: parameter, tip, defect, Q&A, guide, and posture chunks
- Master input: structured expert knowhow form and RAG chunk preview

## Current Verification

Passed:

```bash
cd apps/web
npm run build
npm run lint

cd ../..
npm run setup:api
npm run check:api
```

Running server:

```text
http://localhost:3010
http://localhost:8000
```

Log files:

```text
logs/web-dev.out.log
logs/web-dev.err.log
```

## Backend Integration Points

The frontend expects:

- `GET /api/health`
- `GET /api/materials`
- `GET /api/positions`
- `GET /api/sources`
- `GET /api/training-videos`
- `GET /api/video/{source_id}`
- `GET /api/video-status/{source_id}`
- `POST /api/videos/upload`
- `POST /api/knowhow`
- `POST /api/knowledge`
- `POST /api/answer`
- `POST /api/upload`
- `POST /api/feedback`

Default API URL:

```text
http://localhost:8000
```

Override with:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Next Team Tasks

- Confirm backend API is running and media paths are exposed correctly.
- Upload real pipe work videos from the `작업 영상` page or copy them into `apps/api/dataset/video`.
- If needed, add bounding-box overlays on top of the current Vertex/Gemini image+RAG feedback.

## Video Files

Video metadata is already mapped through `apps/api/dataset/sources.json`.

The Git upload package does not include large mp4 files. Use the zip package or put shared video files here:

```text
apps/api/dataset/video
```

Filenames must match the `video` values in `sources.json`.

Alternatively, use the web UI:

```text
작업 영상 -> Upload training video -> select source -> choose file -> Upload and map video
```

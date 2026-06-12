# Master-Copy TIG Welding Training Hub

This folder is the team-shareable final implementation package.

The app combines:

- Pipe TIG training video browsing by material and welding position
- RAG-style master knowhow chatbot
- Work-photo upload and corrective feedback agent flow
- Structured knowhow archive preview
- Master-welder knowhow input form and RAG chunk preview

## Folder Structure

```text
최종_웹구현/
  apps/
    api/                 FastAPI backend copied from Git_BE
    web/                 Next.js final frontend implementation
  docs/
    API_CONTRACT.md
    STRUCTURE.md
    최종_웹구현_implementation_plan.md
  reference_designs/
    민성_FE/             Stitch and Claude reference outputs
  logs/
    web-dev.out.log
    web-dev.err.log
```

## Run Web

```bash
cd apps/web
npm install
npm run dev -- -p 3010
```

Current local test URL:

```text
http://localhost:3010
```

## Run API

From the project root:

```bash
npm run setup:api
npm run dev:api
```

The frontend uses this default API base URL:

```text
http://localhost:8000
```

If the backend runs elsewhere, create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## GCP Vertex AI Setup

If you use GCP, configure the backend as Vertex AI, not as a Gemini API key.

Create `apps/api/rag_pipeline/.env` from `apps/api/rag_pipeline/.env.example`:

```env
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
```

Then authenticate the API server with one of these methods:

```bash
gcloud auth application-default login
```

or set a service-account JSON path:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
```

Also make sure the Vertex AI API is enabled in that GCP project. Restart `npm run dev:api` after changing `.env`.

## Frontend Validation

These commands passed in `apps/web`:

```bash
npm run build
npm run lint
```

Backend validation from the project root:

```bash
npm run check:api
```

The app also responds with HTTP 200 at `http://localhost:3010`.

## Implemented Backend Mapping

- Video catalog: `apps/api/dataset/sources.json` -> `GET /api/sources`
- Filtered videos: `GET /api/training-videos?material=...&position=...`
- Video streaming: `GET /api/video/{source_id}`
- Video file status: `GET /api/video-status/{source_id}`
- Video upload and mapping: `POST /api/videos/upload`
- Structured knowhow: `POST /api/knowhow`
- Master knowhow save: `POST /api/knowledge`
- Chatbot RAG answer: `POST /api/answer`
- Photo upload: `POST /api/upload`
- Photo feedback agent: `POST /api/feedback`

The frontend now calls these endpoints directly.

## Notes

- Original folders (`Git_BE`, `Git_FE`, `민성_FE`, `Git_All`) were not modified.
- The frontend can run in demo fallback mode when the API is offline.
- If no `GROQ_API_KEY`, Gemini API key, or GCP Vertex AI project is configured, `/api/answer` returns a local RAG fallback answer from the dataset instead of calling an external LLM.
- Actual video playback requires mp4 files to be placed under `apps/api/dataset/video` with the exact filenames listed in `apps/api/dataset/sources.json`.
- Videos can also be uploaded from the `작업 영상` page. Select a target source, choose an mp4/mov/webm file, and click `Upload and map video`.
- If mp4 files are missing, the UI still shows the mapped metadata and marks the item as `metadata only`.
- `숙련공 입력` now saves to the backend RAG JSON dataset through `/api/knowledge`.

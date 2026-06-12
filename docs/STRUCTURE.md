# Structure Audit

## Source Inputs

`Git_BE` is a FastAPI/RAG backend. It contains the HTTP API, retrieval/agent code, curated JSON knowledge, markdown guide documents, video metadata, and a prebuilt Chroma index.

`Git_FE` is a Next.js App Router frontend. It contains one main page, component-level UI, mock data, and a small API client that calls the backend feedback endpoint.

Both original folders were treated as read-only. `Git_All` is a separate integration workspace.

## Integrated Layout

```text
Git_All/
  package.json
  .gitignore
  apps/
    api/
      README.md
      .gitignore
      dataset/
        rag/
        chatbot_docs/
        video/
        sources.json
      rag_pipeline/
        server.py
        agent.py
        rag_api.py
        retriever.py
        loader.py
        docs_loader.py
        citations.py
        chatbot.py
        build_index.py
        evaluate.py
        cli.py
        rag
        requirements.txt
        chroma_db/
    web/
      app/
      components/
      lib/
      types/
      package.json
      package-lock.json
      next.config.ts
      tailwind.config.ts
      tsconfig.json
  docs/
    STRUCTURE.md
    API_CONTRACT.md
```

## Backend Shape

Primary entry point:

- `apps/api/rag_pipeline/server.py`

Important endpoints:

- `GET /api/health`
- `GET /api/materials`
- `GET /api/positions`
- `GET /api/sources`
- `GET /api/training-videos?material=&position=`
- `GET /api/video/{source_id}`
- `POST /api/upload`
- `POST /api/knowhow`
- `POST /api/feedback`
- `POST /api/answer`

Important modules:

- `rag_api.py`: builds structured knowhow JSON from material, position, optional query.
- `agent.py`: calls `rag_api.get_knowhow`, then produces feedback JSON through Groq/Gemini or dry-run fallback.
- `retriever.py`: Chroma-backed vector retrieval and metadata filtering.
- `loader.py`: loads `dataset/rag/**/*.json`; defines `DATASET_DIR`.
- `docs_loader.py`: loads markdown guide sections from `dataset/chatbot_docs`.
- `citations.py`: maps source IDs to videos through `dataset/sources.json`.

Dataset role:

- `dataset/rag`: structured welding knowhow by material and position.
- `dataset/chatbot_docs`: guide text used as LLM context.
- `dataset/sources.json`: video citation catalog.
- `dataset/video`: expected location for large local media files; only README is present.

## Frontend Shape

Primary entry point:

- `apps/web/app/page.tsx`

Current data flow:

- `page.tsx` owns filter state, chat messages, active chat, and loading state.
- `lib/api.ts` maps UI material labels to backend material keys and calls `POST /api/feedback`.
- `lib/mock-data.ts` still supplies initial messages, recent chats, and static resource cards.
- `ResourcePanel`, `VideoCard`, and parts of `MessageBubble` are still largely static or citation-rendering wrappers.

Current UI areas:

- `Sidebar`: recent chats and new chat entry.
- `FilterPanel` / `MobileToolbar`: material, position, stage filters.
- `ChatWindow` / `ChatInput` / `MessageBubble`: conversational interaction.
- `FeedbackCards`: summary, key points, warnings, next steps.
- `ResourcePanel`: static videos and document card.

## Integration Decisions

- Backend code and dataset were copied under `apps/api` with the same relative relationship used by the original backend.
- Frontend code was copied under `apps/web` without `node_modules`, `.next`, cache, or logs.
- Root npm scripts are convenience wrappers only; each app remains independently understandable.
- No original files in `Git_BE` or `Git_FE` were modified.

## Rewrite-Relevant Observations

- The backend API contract is already strong enough for a real frontend: feedback, citations, training videos, upload classification, knowhow, and source listing are available.
- The current frontend only uses `POST /api/feedback`; it does not yet use upload, knowhow, sources, or material/position discovery.
- The current stage filter is UI-only and is not sent to the backend.
- Mock data remains mixed with live API calls, so the next frontend pass should separate real backend state from demo/default content.
- Text rendered from existing files appears encoding-damaged in several places. Treat user-facing copy as rewrite material rather than preserving it blindly.

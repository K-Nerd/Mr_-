# API Contract

Base URL:

```text
http://localhost:8000
```

## Health

`GET /api/health`

Response:

```json
{
  "status": "ok"
}
```

## Metadata

`GET /api/materials`

Response:

```json
["aluminum", "carbon_steel", "stainless"]
```

`GET /api/positions`

Response:

```json
["1G", "2G", "5G", "6G"]
```

`GET /api/sources`

Returns the full video source catalog:

```json
[
  {
    "id": "video_ss_6g",
    "title": "string",
    "video_url": "/api/video/video_ss_6g",
    "material": "stainless",
    "position": "6G"
  }
]
```

## Training Videos

`GET /api/training-videos?material=stainless&position=6G`

Query parameters are optional.

Response:

```json
[
  {
    "id": "video_ss_6g",
    "title": "string",
    "material": "stainless",
    "position": "6G",
    "video_url": "/api/video/video_ss_6g"
  }
]
```

## Feedback

`POST /api/feedback`

Request:

```json
{
  "material": "stainless",
  "position": "6G",
  "observation": "Back bead is uneven near the 6 o'clock section.",
  "upload_id": "optional-upload-id-from-/api/upload",
  "top_k": 5,
  "dry_run": false
}
```

If `upload_id` points to an uploaded image file, the backend sends the image bytes and RAG knowhow context together to Vertex/Gemini. Without `upload_id`, feedback is text+RAG only.

Response shape:

```json
{
  "classification": {
    "material": "stainless",
    "position": "6G"
  },
  "observation": "string",
  "feedback": {
    "summary": "string",
    "key_points": ["string"],
    "warnings": ["string"],
    "next_steps": ["string"]
  },
  "knowhow": {
    "parameters": {},
    "guide_sections_count": 0,
    "tips_count": 0,
    "defects_count": 0
  },
  "citations": [
    {
      "id": "video_ss_6g",
      "title": "string",
      "video": "video/stainless steel 6G pipe TIG welding.mp4",
      "material": "stainless",
      "position": "6G"
    }
  ],
  "llm": {
    "provider": "vertex",
    "model": "gemini-2.5-flash",
    "used_env": "GCP_PROJECT_ID",
    "dry_run": false,
    "vision": true
  },
  "image": {
    "upload_id": "string",
    "mime_type": "image/png",
    "size_bytes": 12345
  },
  "training_videos": [
    {
      "id": "video_posture_high",
      "title": "string",
      "material": "",
      "position": "6G",
      "video_url": "/api/video/video_posture_high"
    }
  ]
}
```

## Knowhow

`POST /api/knowhow`

Request:

```json
{
  "material": "stainless",
  "position": "6G",
  "query": "Back bead is uneven.",
  "top_k": 5,
  "include_posture": true
}
```

Response includes:

- `parameters`
- `expert_tips`
- `defect_solutions`
- `qa`
- `guide_sections`
- `posture_notes`
- `citations`
- `missing_videos`

## Upload

`POST /api/upload`

Multipart fields:

- `file`: required
- `material`: optional override
- `position`: optional override

Response:

```json
{
  "upload_id": "string",
  "stored_path": "uploads/file.ext",
  "original_filename": "string",
  "size_bytes": 123,
  "classification": {
    "material": "stainless",
    "position": "6G",
    "confidence": 0.85,
    "source": "filename"
  }
}
```

## Video

`GET /api/video/{source_id}`

Streams the local video file when it exists under `apps/api/dataset/video`.
# Implementation Update

The final web app now calls the copied FastAPI backend directly.

Current implemented endpoints:

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

Video items include:

```json
{
  "id": "video_ss_6g",
  "title": "6 inch stainless pipe TIG welding",
  "video": "video/stainless steel 6G pipe TIG welding.mp4",
  "video_url": "/api/video/video_ss_6g",
  "video_available": false,
  "material": "stainless",
  "position": "6G",
  "topic": "",
  "subtopic": ""
}
```

`video_available=false` means the source is mapped but the mp4 file is not present under `apps/api/dataset/video`.

`POST /api/videos/upload` accepts multipart form data:

- `file`: mp4/mov/webm/m4v
- `source_id`: existing source id, optional
- `title`: optional title override
- `material`: `carbon_steel | stainless | aluminum`
- `position`: `1G | 2G | 5G | 6G`

`POST /api/knowledge` saves master-welder input into the local RAG JSON dataset.

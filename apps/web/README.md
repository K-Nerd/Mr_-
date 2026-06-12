# Web App

Next.js frontend for the Master-Copy TIG welding training hub.

## Run

```bash
npm install
npm run dev -- -p 3010
```

Open:

```text
http://localhost:3010
```

## Validate

```bash
npm run build
npm run lint
```

## API

Default backend URL:

```text
http://localhost:8000
```

Override with `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The UI has offline demo fallback data, so it can still be reviewed when the backend is not running.

For full video/chatbot/photo-feedback integration, run the API from the project root:

```bash
npm run setup:api
npm run dev:api
```

Connected endpoints include `/api/sources`, `/api/training-videos`, `/api/answer`, `/api/upload`, and `/api/feedback`.

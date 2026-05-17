# CloudConvert-style Converter (MERN + TypeScript)

Local-first file converter inspired by CloudConvert: upload → choose output format → convert with live progress → download.

## Theme
- Background: `#0e0e0e`
- Surface: `#161616`
- Accent: `#d4ff00`
- Text: `#f0f0f0`
- Muted: `#666`

## Setup

### 1) Install
```bash
npm install
```

### 2) Configure (optional MongoDB)
Create `server/.env`:
```bash
PORT=5175
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/cloudconvert_clone
```

MongoDB is optional; if `MONGODB_URI` is missing, the server uses an in-memory store.

### 3) Run dev
```bash
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:5175`

## Supported conversions (server-side)
- Images: `png` / `jpg` / `webp` (via `sharp`)
- Text: `txt → pdf` (via `pdfkit`)
- Fallback: unknown conversions are returned as the original file with the new extension (clearly marked in job result)


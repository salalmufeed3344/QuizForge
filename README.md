# QuizForge — notes-to-quiz app (IceHacks 2026)

Paste lecture notes, get an AI-generated multiple-choice quiz with
explanations plus flashcards of the key terms. Take the quiz, see your
score, review what you missed.

Built during IceHacks 2026 (Nov 9–15, 2026) by Salal Mufeed. Targets
**Best AI Hack** and **Best Deployed / Shipped App**.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, React 19. No
database, no auth, nothing stored.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## AI setup (optional but recommended)

The quiz generator uses Google Gemini when a key is configured, and
falls back to a deterministic offline generator (built straight from
the notes) when it isn't — so the app always works.

1. Get a free key at https://aistudio.google.com/apikey (no card).
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.
3. Restart the dev server.

Model: `gemini-2.5-flash`, called via the REST API with a strict JSON
response schema. If the key is missing, invalid, or quota-limited, the
API route falls back to the offline generator automatically.

## Project layout

- `app/page.tsx` — input stage + quiz/flashcard tabs
- `app/components/QuizPlayer.tsx` — quiz flow, scoring, review
- `app/components/Flashcards.tsx` — flip-card deck
- `app/api/generate/route.ts` — POST /api/generate
- `app/lib/gemini.ts` — Gemini REST call (JSON-schema response)
- `app/lib/offline.ts` — deterministic no-key quiz generator
- `app/lib/types.ts` — shared types

## Deploy

Vercel (recommended) or Netlify. Set `GEMINI_API_KEY` in the host's
environment variables to enable AI generation in production.

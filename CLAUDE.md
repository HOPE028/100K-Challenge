# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server with hot reload
npm run build    # TypeScript compile + Vite production build
npm run preview  # Serve the production build locally
```

No test or lint scripts are configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in Firebase credentials. If Firebase vars are absent, the app runs in local/demo mode with in-memory state and `crypto.randomUUID()` for IDs.

## Architecture

Single-page React 19 + TypeScript app using Vite. All state lives in the single `<App>` component (`src/App.tsx`) via `useState`/`useEffect`/`useMemo`.

**Two operational modes:**
- **Firebase mode**: `onSnapshot()` listener on the `challengeEntries` Firestore collection keeps the UI in sync in real time. Writes use `addDoc()` + `serverTimestamp()`.
- **Demo mode**: Falls back to local React state with sample data when Firebase config is missing.

**Data flow:**
1. User submits a form (manual entry or `parseQuickEntry` freeform text)
2. `calculateLoadMoved()` computes pounds moved — pull-ups use bodyweight, all other lifts use bar weight
3. Entry written to Firestore (or local state) as a `WorkoutEntry`
4. Snapshot listener re-derives dashboard stats, chart series, and lift breakdowns via `useMemo`

**Key source files:**
- `src/App.tsx` — entire UI and state machine
- `src/lib/workout.ts` — pure utility functions (calculations, parsing, formatting)
- `src/types.ts` — `WorkoutEntry`, `LiftType`, `RelativeTimeOption`, `FormState`
- `src/firebase.ts` — Firebase app init and exported `db` Firestore instance

## Data Model

```typescript
type LiftType = "pull_up" | "bench_press" | "squat" | "deadlift"

type WorkoutEntry = {
  id: string
  liftType: LiftType
  reps: number
  weight: number | null      // null for pull-ups
  performedAt: string        // ISO string
  loadMoved: number          // pre-calculated: reps × weight (or bodyweight)
  bodyweightUsed: number | null
  source: "manual" | "voice"
  createdAt?: string         // Firestore server timestamp
}
```

Firestore collection: `challengeEntries`, ordered by `performedAt`.

## Goal Logic

The challenge target is **100,000 lb** total load moved. `getProgressPercent()`, `getRemainingLoad()`, and `buildCumulativeSeries()` in `src/lib/workout.ts` drive all progress calculations.

## `parseQuickEntry`

Accepts freeform strings like `"deadlift 225 x 5 10 minutes ago"` with lift aliases (e.g., `dl` → `deadlift`, `bp` → `bench_press`). Returns a partial `WorkoutEntry` or `null` on parse failure.

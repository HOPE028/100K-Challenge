# 100,000 lb Challenge App

A mobile-first React + Firebase app for logging pull-ups, bench press, squats, and deadlifts during a single 100,000-pound challenge.

## Features

- Quick log with freeform text such as `deadlift 225 x 5 10 minutes ago`
- Optional browser voice capture for hands-free entry on supported phones
- Pull-up math uses bodyweight instead of bar weight
- Dashboard cards for total pounds moved, remaining pounds, and entry count
- Live breakdown by lift type and a cumulative load-over-time chart
- Firestore sync when Firebase config is present, plus demo/local mode when it is not

## Setup

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Fill in your Firebase web app keys
4. Start the app with `npm run dev`

## Firestore shape

Entries are stored in the `challengeEntries` collection with:

- `liftType`
- `reps`
- `weight`
- `performedAt`
- `loadMoved`
- `bodyweightUsed`
- `source`
- `createdAt`

## Suggested Firestore rules

For a quick single-user event app, you can start with a locked-down ruleset that only your signed-in account can write. If you want, the next step can be wiring Firebase Auth or tightening the rules for public hosting.
# 100K-Challenge

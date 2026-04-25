import type { LiftType, RelativeTimeOption, WorkoutEntry } from "../types";

export const CHALLENGE_GOAL = 100_000;
export const DEFAULT_BODYWEIGHT =
  Number(import.meta.env.VITE_DEFAULT_BODYWEIGHT) || 180;

export const LIFT_LABELS: Record<LiftType, string> = {
  pull_up: "Pull-up",
  bench_press: "Bench Press",
  squat: "Squat",
  deadlift: "Deadlift",
};

const LIFT_ALIASES: Record<string, LiftType> = {
  pull: "pull_up",
  pullup: "pull_up",
  pullups: "pull_up",
  "pull-up": "pull_up",
  "pull-ups": "pull_up",
  bench: "bench_press",
  "benchpress": "bench_press",
  "bench-press": "bench_press",
  squat: "squat",
  squats: "squat",
  deadlift: "deadlift",
  deadlifts: "deadlift",
  dead: "deadlift",
};

export const RELATIVE_TIME_OPTIONS: Array<{
  label: string;
  value: RelativeTimeOption;
}> = [
  { label: "Now", value: 0 },
  { label: "5 min ago", value: 5 },
  { label: "10 min ago", value: 10 },
  { label: "15 min ago", value: 15 },
  { label: "30 min ago", value: 30 },
];

export const getPerformedAtIso = (minutesAgo: RelativeTimeOption) =>
  new Date(Date.now() - minutesAgo * 60_000).toISOString();

export const calculateLoadMoved = ({
  liftType,
  reps,
  weight,
  bodyweight,
}: {
  liftType: LiftType;
  reps: number;
  weight: number | null;
  bodyweight: number;
}) => {
  if (liftType === "pull_up") {
    return reps * bodyweight;
  }

  return reps * (weight ?? 0);
};

export const formatPounds = (value: number) =>
  `${Math.round(value).toLocaleString()} lb`;

export const formatLift = (liftType: LiftType) => LIFT_LABELS[liftType];

export const formatPerformedAt = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));

export const buildCumulativeSeries = (entries: WorkoutEntry[]) => {
  let runningTotal = 0;

  return entries
    .slice()
    .sort(
      (left, right) =>
        new Date(left.performedAt).getTime() - new Date(right.performedAt).getTime(),
    )
    .map((entry) => {
      runningTotal += entry.loadMoved;

      return {
        time: new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(entry.performedAt)),
        total: runningTotal,
      };
    });
};

export const buildLiftBreakdown = (entries: WorkoutEntry[]) =>
  (Object.keys(LIFT_LABELS) as LiftType[]).map((liftType) => {
    const filtered = entries.filter((entry) => entry.liftType === liftType);

    return {
      liftType,
      label: formatLift(liftType),
      entries: filtered.length,
      reps: filtered.reduce((sum, entry) => sum + entry.reps, 0),
      loadMoved: filtered.reduce((sum, entry) => sum + entry.loadMoved, 0),
    };
  });

export const parseQuickEntry = (
  raw: string,
  bodyweight: number,
): {
  liftType: LiftType;
  reps: number;
  weight: number | null;
  minutesAgo: RelativeTimeOption;
} | null => {
  const normalized = raw.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const liftType = Object.entries(LIFT_ALIASES).find(([alias]) =>
    normalized.includes(alias),
  )?.[1];

  if (!liftType) {
    return null;
  }

  const repsMatch =
    normalized.match(/(?:x|for)\s*(\d{1,3})/) ??
    normalized.match(/(\d{1,3})\s*reps?/) ??
    normalized.match(/\b(\d{1,3})\b(?!.*\b\d{1,3}\b)/);
  const reps = Number(repsMatch?.[1]);

  if (!reps || Number.isNaN(reps)) {
    return null;
  }

  const minutesMatch = normalized.match(/(\d{1,2})\s*(?:min|mins|minute|minutes)/);
  const parsedMinutes = Number(minutesMatch?.[1] ?? 0);
  const allowedMinutes: RelativeTimeOption[] = [0, 5, 10, 15, 30];
  const minutesAgo = allowedMinutes.includes(parsedMinutes as RelativeTimeOption)
    ? (parsedMinutes as RelativeTimeOption)
    : 0;

  if (liftType === "pull_up") {
    return {
      liftType,
      reps,
      weight: null,
      minutesAgo,
    };
  }

  const allNumbers = Array.from(normalized.matchAll(/\b(\d{1,4})\b/g)).map((match) =>
    Number(match[1]),
  );
  const weight = allNumbers.find((value) => value !== reps && value !== parsedMinutes);

  if (!weight) {
    return null;
  }

  return {
    liftType,
    reps,
    weight,
    minutesAgo,
  };
};

export const getProgressPercent = (totalMoved: number) =>
  Math.min((totalMoved / CHALLENGE_GOAL) * 100, 100);

export const getRemainingLoad = (totalMoved: number) =>
  Math.max(CHALLENGE_GOAL - totalMoved, 0);

export const getFirestoreCollectionName = () => "challengeEntries";

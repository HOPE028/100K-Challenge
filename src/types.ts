export type LiftType = "pull_up" | "bench_press" | "squat" | "deadlift";

export type RelativeTimeOption = 0 | 5 | 10 | 15 | 30;

export type WorkoutEntry = {
  id: string;
  liftType: LiftType;
  reps: number;
  weight: number | null;
  performedAt: string;
  loadMoved: number;
  bodyweightUsed: number | null;
  source: "manual" | "voice";
  createdAt?: string;
};

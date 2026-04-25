import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseReady, firestore } from "./firebase";
import type { LiftType, RelativeTimeOption, WorkoutEntry } from "./types";
import {
  DEFAULT_BODYWEIGHT,
  RELATIVE_TIME_OPTIONS,
  buildCumulativeSeries,
  buildLiftBreakdown,
  calculateLoadMoved,
  formatLift,
  formatPerformedAt,
  formatPounds,
  getFirestoreCollectionName,
  getPerformedAtIso,
  getProgressPercent,
  getRemainingLoad,
} from "./lib/workout";

type FormState = {
  liftType: LiftType;
  reps: string;
  weight: string;
  minutesAgo: RelativeTimeOption;
};

const defaultFormState: FormState = {
  liftType: "deadlift",
  reps: "",
  weight: "",
  minutesAgo: 0,
};

const demoEntries: WorkoutEntry[] = [
  {
    id: "demo-1",
    liftType: "deadlift",
    reps: 5,
    weight: 225,
    performedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    loadMoved: 1_125,
    bodyweightUsed: null,
    source: "manual",
  },
  {
    id: "demo-2",
    liftType: "pull_up",
    reps: 10,
    weight: null,
    performedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    loadMoved: DEFAULT_BODYWEIGHT * 10,
    bodyweightUsed: DEFAULT_BODYWEIGHT,
    source: "voice",
  },
  {
    id: "demo-3",
    liftType: "bench_press",
    reps: 8,
    weight: 135,
    performedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    loadMoved: 1_080,
    bodyweightUsed: null,
    source: "manual",
  },
];

function App() {
  const [bodyweight, setBodyweight] = useState(String(DEFAULT_BODYWEIGHT));
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [feedback, setFeedback] = useState("Ready to log.");
  const [saveState, setSaveState] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    if (!firestore) {
      setEntries(demoEntries);
      setFeedback("Firebase not configured yet, showing demo data.");
      return undefined;
    }

    const entryQuery = query(
      collection(firestore, getFirestoreCollectionName()),
      orderBy("performedAt", "asc"),
    );

    return onSnapshot(entryQuery, (snapshot) => {
      const nextEntries = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          liftType: data.liftType as LiftType,
          reps: data.reps as number,
          weight: (data.weight as number | null) ?? null,
          performedAt: data.performedAt as string,
          loadMoved: data.loadMoved as number,
          bodyweightUsed: (data.bodyweightUsed as number | null) ?? null,
          source: (data.source as "manual" | "voice") ?? "manual",
          createdAt:
            typeof data.createdAt?.toDate === "function"
              ? data.createdAt.toDate().toISOString()
              : undefined,
        } satisfies WorkoutEntry;
      });

      setEntries(nextEntries);
    });
  }, []);

  const totalMoved = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.loadMoved, 0),
    [entries],
  );
  const progressPercent = getProgressPercent(totalMoved);
  const remainingLoad = getRemainingLoad(totalMoved);
  const liftBreakdown = useMemo(() => buildLiftBreakdown(entries), [entries]);
  const cumulativeSeries = useMemo(() => buildCumulativeSeries(entries), [entries]);
  const chartPoints = useMemo(() => {
    if (!cumulativeSeries.length) {
      return "";
    }

    const maxTotal = Math.max(...cumulativeSeries.map((point) => point.total), 1);

    return cumulativeSeries
      .map((point, index) => {
        const x =
          cumulativeSeries.length === 1
            ? 50
            : (index / (cumulativeSeries.length - 1)) * 100;
        const y = 100 - (point.total / maxTotal) * 84 - 8;
        return `${x},${y}`;
      })
      .join(" ");
  }, [cumulativeSeries]);
  const chartArea = useMemo(() => {
    if (!chartPoints) {
      return "";
    }

    return `M 0 92 L ${chartPoints.replaceAll(" ", " L ")} L 100 92 Z`;
  }, [chartPoints]);
  const bodyweightNumber = Number(bodyweight) || DEFAULT_BODYWEIGHT;

  const resetForm = () => {
    setForm({
      ...defaultFormState,
      liftType: form.liftType,
    });
  };

  const saveEntry = async ({
    liftType,
    reps,
    weight,
    minutesAgo,
    source,
  }: {
    liftType: LiftType;
    reps: number;
    weight: number | null;
    minutesAgo: RelativeTimeOption;
    source: "manual" | "voice";
  }) => {
    const performedAt = getPerformedAtIso(minutesAgo);
    const loadMoved = calculateLoadMoved({
      liftType,
      reps,
      weight,
      bodyweight: bodyweightNumber,
    });

    if (!firestore) {
      const localEntry: WorkoutEntry = {
        id: crypto.randomUUID(),
        liftType,
        reps,
        weight,
        performedAt,
        loadMoved,
        bodyweightUsed: liftType === "pull_up" ? bodyweightNumber : null,
        source,
      };

      setEntries((current) =>
        [...current, localEntry].sort(
          (left, right) =>
            new Date(left.performedAt).getTime() - new Date(right.performedAt).getTime(),
        ),
      );
      setFeedback("Saved locally. Add Firebase config to sync live.");
      return;
    }

    setSaveState("saving");

    try {
      await addDoc(collection(firestore, getFirestoreCollectionName()), {
        liftType,
        reps,
        weight,
        performedAt,
        loadMoved,
        bodyweightUsed: liftType === "pull_up" ? bodyweightNumber : null,
        source,
        createdAt: serverTimestamp(),
      });
      setFeedback(`${formatLift(liftType)} logged.`);
    } finally {
      setSaveState("idle");
    }
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const reps = Number(form.reps);
    const weight = form.liftType === "pull_up" ? null : Number(form.weight);

    if (!reps || reps < 1) {
      setFeedback("Add reps before saving.");
      return;
    }

    if (form.liftType !== "pull_up" && (!weight || weight < 1)) {
      setFeedback("Add the lifted weight before saving.");
      return;
    }

    await saveEntry({
      liftType: form.liftType,
      reps,
      weight,
      minutesAgo: form.minutesAgo,
      source: "manual",
    });
    resetForm();
  };

  return (
    <div className="app-shell">
      <div className="glow glow-left" />
      <div className="glow glow-right" />

      <main className="app">
        <section className="hero-card">
          <p className="eyebrow">100,000 lb challenge</p>
          <div className="hero-header">
            <div>
              <h1>Live lifting dashboard</h1>
              <p className="hero-copy">
                Log sets fast, track your total tonnage, and keep the whole
                challenge visible from your phone.
              </p>
            </div>
            <div className="progress-ring">
              <svg viewBox="0 0 120 120" className="ring-svg" aria-hidden="true">
                <circle cx="60" cy="60" r="48" className="ring-track" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  className="ring-progress"
                  style={{
                    strokeDasharray: `${progressPercent * 3.016} 302`,
                  }}
                />
              </svg>
              <div className="progress-copy">
                <strong>{Math.round(progressPercent)}%</strong>
                <span>{formatPounds(totalMoved)}</span>
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <article>
              <span>Total moved</span>
              <strong>{formatPounds(totalMoved)}</strong>
            </article>
            <article>
              <span>Remaining</span>
              <strong>{formatPounds(remainingLoad)}</strong>
            </article>
            <article>
              <span>Entries</span>
              <strong>{entries.length}</strong>
            </article>
          </div>
        </section>

        <section className="panel entry-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Log a set</p>
              <h2>Fast manual entry</h2>
            </div>
          </div>

          <form className="entry-form compact-form" onSubmit={handleManualSubmit}>
            <label className="input-label">
              Lift
              <select
                value={form.liftType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    liftType: event.target.value as LiftType,
                  }))
                }
              >
                <option value="pull_up">Pull-up</option>
                <option value="bench_press">Bench Press</option>
                <option value="squat">Squat</option>
                <option value="deadlift">Deadlift</option>
              </select>
            </label>

            <label className="input-label">
              Reps
              <input
                inputMode="numeric"
                value={form.reps}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reps: event.target.value }))
                }
                placeholder="5"
              />
            </label>

            <label className="input-label">
              {form.liftType === "pull_up" ? "Bodyweight" : "Weight"}
              <input
                inputMode="numeric"
                value={form.liftType === "pull_up" ? bodyweight : form.weight}
                onChange={(event) =>
                  form.liftType === "pull_up"
                    ? setBodyweight(event.target.value)
                    : setForm((current) => ({
                        ...current,
                        weight: event.target.value,
                      }))
                }
                placeholder={form.liftType === "pull_up" ? "180" : "225"}
              />
            </label>

            <label className="input-label">
              When
              <select
                value={form.minutesAgo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minutesAgo: Number(event.target.value) as RelativeTimeOption,
                  }))
                }
              >
                {RELATIVE_TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Saving..." : "Save entry"}
            </button>
          </form>

          <p className="helper-copy">
            Pull-ups automatically use your bodyweight instead of bar weight.
          </p>
        </section>

        <section className="status-strip">
          <span className={`status-dot ${firebaseReady ? "live" : "demo"}`} />
          <span>{feedback}</span>
        </section>

        <section className="panel-grid dashboard-grid">
          <section className="panel chart-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Progress over time</p>
                <h2>Cumulative load</h2>
              </div>
            </div>

            <div className="chart-wrap">
              {cumulativeSeries.length ? (
                <div className="svg-chart">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.75" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.06" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="92" x2="100" y2="92" className="chart-axis" />
                    <line x1="0" y1="60" x2="100" y2="60" className="chart-grid" />
                    <line x1="0" y1="28" x2="100" y2="28" className="chart-grid" />
                    <path d={chartArea} className="chart-area" />
                    <polyline points={chartPoints} className="chart-line" />
                  </svg>

                  <div className="chart-labels">
                    {cumulativeSeries.map((point, index) => (
                      <div key={`${point.time}-${index}`}>
                        <strong>{point.time}</strong>
                        <span>{formatPounds(point.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-chart">
                  <strong>No data yet</strong>
                  <span>Log your first set to start the timeline.</span>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">By lift</p>
                <h2>Workout breakdown</h2>
              </div>
            </div>

            <div className="breakdown-list">
              {liftBreakdown.map((item) => (
                <article key={item.liftType} className="breakdown-card">
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.entries} sets logged</span>
                  </div>
                  <div>
                    <strong>{formatPounds(item.loadMoved)}</strong>
                    <span>{item.reps} reps</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent sets</p>
              <h2>Latest entries</h2>
            </div>
          </div>

          <div className="recent-list">
            {entries
              .slice()
              .reverse()
              .map((entry) => (
                <article key={entry.id} className="recent-card">
                  <div>
                    <strong>{formatLift(entry.liftType)}</strong>
                    <span>{formatPerformedAt(entry.performedAt)}</span>
                  </div>
                  <div>
                    <strong>{formatPounds(entry.loadMoved)}</strong>
                    <span>
                      {entry.weight ? `${entry.weight} lb x ${entry.reps}` : `${entry.reps} reps`}
                    </span>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

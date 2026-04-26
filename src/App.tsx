import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from './firebase'
import type { LiftType, WorkoutEntry } from './types'
import {
  DEFAULT_BODYWEIGHT,
  buildCumulativeSeries,
  buildLiftBreakdown,
  formatLift,
  formatPerformedAt,
  formatPounds,
  getFirestoreCollectionName,
  getProgressPercent,
  getRemainingLoad,
} from './lib/workout'

const demoEntries: WorkoutEntry[] = [
  {
    id: 'demo-1',
    liftType: 'deadlift',
    reps: 5,
    weight: 225,
    performedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    loadMoved: 1_125,
    bodyweightUsed: null,
    source: 'manual',
  },
  {
    id: 'demo-2',
    liftType: 'pull_up',
    reps: 10,
    weight: null,
    performedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    loadMoved: DEFAULT_BODYWEIGHT * 10,
    bodyweightUsed: DEFAULT_BODYWEIGHT,
    source: 'voice',
  },
  {
    id: 'demo-3',
    liftType: 'bench_press',
    reps: 8,
    weight: 135,
    performedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    loadMoved: 1_080,
    bodyweightUsed: null,
    source: 'manual',
  },
]

function App() {
  const [entries, setEntries] = useState<WorkoutEntry[]>([])

  useEffect(() => {
    if (!firestore) {
      setEntries(demoEntries)
      return undefined
    }

    const entryQuery = query(
      collection(firestore, getFirestoreCollectionName()),
      orderBy('performedAt', 'asc'),
    )

    return onSnapshot(entryQuery, (snapshot) => {
      const nextEntries = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          liftType: data.liftType as LiftType,
          reps: data.reps as number,
          weight: (data.weight as number | null) ?? null,
          performedAt: data.performedAt as string,
          loadMoved: data.loadMoved as number,
          bodyweightUsed: (data.bodyweightUsed as number | null) ?? null,
          source: (data.source as 'manual' | 'voice') ?? 'manual',
          createdAt:
            typeof data.createdAt?.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : undefined,
        } satisfies WorkoutEntry
      })

      setEntries(nextEntries)
    })
  }, [])

  const totalMoved = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.loadMoved, 0),
    [entries],
  )
  const progressPercent = getProgressPercent(totalMoved)
  const remainingLoad = getRemainingLoad(totalMoved)
  const liftBreakdown = useMemo(() => buildLiftBreakdown(entries), [entries])
  const cumulativeSeries = useMemo(
    () => buildCumulativeSeries(entries),
    [entries],
  )
  const chartPoints = useMemo(() => {
    if (!cumulativeSeries.length) return ''

    const maxTotal = Math.max(
      ...cumulativeSeries.map((point) => point.total),
      1,
    )

    return cumulativeSeries
      .map((point, index) => {
        const x =
          cumulativeSeries.length === 1
            ? 50
            : (index / (cumulativeSeries.length - 1)) * 100
        const y = 100 - (point.total / maxTotal) * 84 - 8
        return `${x},${y}`
      })
      .join(' ')
  }, [cumulativeSeries])
  const chartArea = useMemo(() => {
    if (!chartPoints) return ''
    return `M 0 92 L ${chartPoints.replaceAll(' ', ' L ')} L 100 92 Z`
  }, [chartPoints])

  return (
    <div className='app-shell'>
      <div className='glow glow-left' />
      <div className='glow glow-right' />

      <main className='app'>
        <section className='hero-card'>
          <p className='eyebrow'>100,000 lb challenge</p>
          <div className='hero-header'>
            <div>
              <h1>Live lifting dashboard</h1>
              <p className='hero-copy'>
                My 100K lb lifting challenge was hard, but successful.
              </p>
            </div>
            <div className='progress-ring'>
              <svg
                viewBox='0 0 120 120'
                className='ring-svg'
                aria-hidden='true'
              >
                <circle cx='60' cy='60' r='48' className='ring-track' />
                <circle
                  cx='60'
                  cy='60'
                  r='48'
                  className='ring-progress'
                  style={{
                    strokeDasharray: `${progressPercent * 3.016} 302`,
                  }}
                />
              </svg>
              <div className='progress-copy'>
                <strong>{Math.round(progressPercent)}%</strong>
              </div>
            </div>
          </div>

          <div className='hero-stats'>
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

        <section className='panel-grid dashboard-grid'>
          <section className='panel chart-panel'>
            <div className='panel-header'>
              <div>
                <p className='eyebrow'>Progress over time</p>
                <h2>Cumulative load</h2>
              </div>
            </div>

            <div className='chart-wrap'>
              {cumulativeSeries.length ? (
                <div className='svg-chart'>
                  <svg
                    viewBox='0 0 100 100'
                    preserveAspectRatio='none'
                    aria-hidden='true'
                  >
                    <defs>
                      <linearGradient
                        id='chartGradient'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='0%'
                          stopColor='#ef4444'
                          stopOpacity='0.75'
                        />
                        <stop
                          offset='100%'
                          stopColor='#ef4444'
                          stopOpacity='0.06'
                        />
                      </linearGradient>
                    </defs>
                    <line
                      x1='0'
                      y1='92'
                      x2='100'
                      y2='92'
                      className='chart-axis'
                    />
                    <line
                      x1='0'
                      y1='60'
                      x2='100'
                      y2='60'
                      className='chart-grid'
                    />
                    <line
                      x1='0'
                      y1='28'
                      x2='100'
                      y2='28'
                      className='chart-grid'
                    />
                    <path d={chartArea} className='chart-area' />
                    <polyline points={chartPoints} className='chart-line' />
                  </svg>

                  <div className='chart-labels'>
                    {cumulativeSeries.map((point, index) => (
                      <div key={`${point.time}-${index}`}>
                        <strong>{point.time}</strong>
                        <span>{formatPounds(point.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className='empty-chart'>
                  <strong>No data yet</strong>
                  <span>No entries to display.</span>
                </div>
              )}
            </div>
          </section>

          <section className='panel'>
            <div className='panel-header'>
              <div>
                <p className='eyebrow'>By lift</p>
                <h2>Workout breakdown</h2>
              </div>
            </div>

            <div className='breakdown-list'>
              {liftBreakdown.map((item) => (
                <article key={item.liftType} className='breakdown-card'>
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

        <section className='panel'>
          <div className='panel-header'>
            <div>
              <p className='eyebrow'>Recent sets</p>
              <h2>Latest entries</h2>
            </div>
          </div>

          <div className='recent-list'>
            {entries
              .slice()
              .reverse()
              .map((entry) => (
                <article key={entry.id} className='recent-card'>
                  <div>
                    <strong>{formatLift(entry.liftType)}</strong>
                    <span>{formatPerformedAt(entry.performedAt)}</span>
                  </div>
                  <div>
                    <strong>{formatPounds(entry.loadMoved)}</strong>
                    <span>
                      {entry.weight
                        ? `${entry.weight} lb x ${entry.reps}`
                        : `${entry.reps} reps`}
                    </span>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { firestore } from './firebase'
import type { LiftType, PushupEntry, WorkoutEntry } from './types'
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

type ChallengeTab = 'lifting' | 'pushups'

const PUSHUP_GOAL = 1_000
const PUSHUP_COLLECTION = 'pushupChallengeEntries'

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

const demoPushupEntries: PushupEntry[] = [
  {
    id: 'pushup-demo-1',
    reps: 40,
    performedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    id: 'pushup-demo-2',
    reps: 35,
    performedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
]

const getLocalIso = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function App() {
  const [activeTab, setActiveTab] = useState<ChallengeTab>('pushups')
  const [entries, setEntries] = useState<WorkoutEntry[]>([])
  const [pushupEntries, setPushupEntries] = useState<PushupEntry[]>([])
  const [pushupReps, setPushupReps] = useState('')
  const [pushupStatus, setPushupStatus] = useState('')
  const [cutoffTime, setCutoffTime] = useState(getLocalIso)

  useEffect(() => {
    if (!firestore) {
      setEntries(demoEntries)
      setPushupEntries(demoPushupEntries)
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

  useEffect(() => {
    if (!firestore) {
      return undefined
    }

    const pushupQuery = query(
      collection(firestore, PUSHUP_COLLECTION),
      orderBy('performedAt', 'asc'),
    )

    return onSnapshot(pushupQuery, (snapshot) => {
      const nextEntries = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          reps: data.reps as number,
          performedAt: data.performedAt as string,
          createdAt:
            typeof data.createdAt?.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : undefined,
        } satisfies PushupEntry
      })

      setPushupEntries(nextEntries)
    })
  }, [])

  const filteredEntries = useMemo(() => {
    const cutoff = new Date(cutoffTime).getTime()
    return entries.filter(
      (entry) => new Date(entry.performedAt).getTime() <= cutoff,
    )
  }, [entries, cutoffTime])

  const totalMoved = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + entry.loadMoved, 0),
    [filteredEntries],
  )
  const progressPercent = getProgressPercent(totalMoved)
  const remainingLoad = getRemainingLoad(totalMoved)
  const liftBreakdown = useMemo(
    () => buildLiftBreakdown(filteredEntries),
    [filteredEntries],
  )
  const cumulativeSeries = useMemo(
    () => buildCumulativeSeries(filteredEntries),
    [filteredEntries],
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
  const totalPushups = useMemo(
    () => pushupEntries.reduce((sum, entry) => sum + entry.reps, 0),
    [pushupEntries],
  )
  const pushupProgressPercent = Math.min((totalPushups / PUSHUP_GOAL) * 100, 100)
  const remainingPushups = Math.max(PUSHUP_GOAL - totalPushups, 0)

  const handlePushupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const reps = Number(pushupReps)
    if (!Number.isInteger(reps) || reps <= 0) {
      setPushupStatus('Enter a positive whole number.')
      return
    }

    const performedAt = new Date().toISOString()

    if (!firestore) {
      setPushupEntries((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          reps,
          performedAt,
        },
      ])
      setPushupReps('')
      setPushupStatus('Added locally.')
      return
    }

    try {
      await addDoc(collection(firestore, PUSHUP_COLLECTION), {
        reps,
        performedAt,
        createdAt: serverTimestamp(),
      })
      setPushupReps('')
      setPushupStatus('Added to push-up challenge.')
    } catch (error) {
      console.error(error)
      setPushupStatus('Could not save push-ups. Try again.')
    }
  }

  return (
    <div className='app-shell'>
      <div className='glow glow-left' />
      <div className='glow glow-right' />

      <main className='app'>
        <nav className='challenge-tabs' aria-label='Challenge tabs'>
          <button
            type='button'
            className={activeTab === 'lifting' ? 'active' : ''}
            onClick={() => setActiveTab('lifting')}
          >
            100K lift
          </button>
          <button
            type='button'
            className={activeTab === 'pushups' ? 'active' : ''}
            onClick={() => setActiveTab('pushups')}
          >
            Push-ups
          </button>
        </nav>

        {activeTab === 'lifting' ? (
          <>
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
              <strong>{filteredEntries.length}</strong>
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
            {filteredEntries
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
            <section className='panel time-filter-panel'>
          <div className='panel-header'>
            <div>
              <p className='eyebrow'>Time machine</p>
              <h2>View snapshot</h2>
            </div>
          </div>
          <div className='time-filter-body'>
            <label className='time-filter-label'>
              Show entries up to
              <input
                type='datetime-local'
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
              />
            </label>
            <p className='filter-meta'>
              Showing {filteredEntries.length} of {entries.length}{' '}
              {entries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
            </section>
          </>
        ) : (
          <>
            <section className='hero-card pushup-hero'>
              <p className='eyebrow'>1,000 push-up challenge</p>
              <div className='hero-header'>
                <div>
                  <h1>One-hour push-up counter</h1>
                  <p className='hero-copy'>
                    Log each set as it happens and track the total toward
                    1,000 reps.
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
                      className='ring-progress pushup-ring'
                      style={{
                        strokeDasharray: `${pushupProgressPercent * 3.016} 302`,
                      }}
                    />
                  </svg>
                  <div className='progress-copy'>
                    <strong>{Math.round(pushupProgressPercent)}%</strong>
                  </div>
                </div>
              </div>

              <div className='hero-stats'>
                <article>
                  <span>Total push-ups</span>
                  <strong>{totalPushups.toLocaleString()}</strong>
                </article>
                <article>
                  <span>Remaining</span>
                  <strong>{remainingPushups.toLocaleString()}</strong>
                </article>
                <article>
                  <span>Sets</span>
                  <strong>{pushupEntries.length}</strong>
                </article>
              </div>
            </section>

            <section className='panel pushup-log-panel'>
              <div className='panel-header'>
                <div>
                  <p className='eyebrow'>Quick log</p>
                  <h2>Add push-ups</h2>
                </div>
              </div>

              <form className='pushup-form' onSubmit={handlePushupSubmit}>
                <label>
                  Push-ups completed
                  <input
                    type='number'
                    min='1'
                    step='1'
                    inputMode='numeric'
                    placeholder='e.g. 25'
                    value={pushupReps}
                    onChange={(event) => setPushupReps(event.target.value)}
                  />
                </label>
                <button type='submit'>Add to total</button>
              </form>
              {pushupStatus ? (
                <p className='filter-meta'>{pushupStatus}</p>
              ) : null}
            </section>

            <section className='panel'>
              <div className='panel-header'>
                <div>
                  <p className='eyebrow'>Recent sets</p>
                  <h2>Push-up entries</h2>
                </div>
              </div>

              <div className='recent-list'>
                {pushupEntries.length ? (
                  pushupEntries
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <article key={entry.id} className='recent-card'>
                        <div>
                          <strong>{entry.reps.toLocaleString()} push-ups</strong>
                          <span>{formatPerformedAt(entry.performedAt)}</span>
                        </div>
                        <div>
                          <strong>
                            {Math.min(
                              (entry.reps / PUSHUP_GOAL) * 100,
                              100,
                            ).toFixed(1)}
                            %
                          </strong>
                          <span>of goal</span>
                        </div>
                      </article>
                    ))
                ) : (
                  <div className='empty-chart'>
                    <strong>No push-ups yet</strong>
                    <span>Add your first set to start the counter.</span>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App

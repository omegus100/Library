import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSaveSettings, useStats } from '../api/hooks'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'
import Rating from '../components/books/Rating'
import { buttonClass } from '../components/Buttons'
import styles from './Stats.module.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STATUS_LABELS = { 'Currently Reading': 'Reading', 'Want To Read': 'Want to read', Read: 'Read', 'Did Not Finish': 'Didn’t finish', none: 'No status' }
const formatDay = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// Reading: yearly goal, books finished per month, and library totals
export default function Stats() {
    const { isOwner } = useAuth()
    const toast = useToast()
    const [year, setYear] = useState(new Date().getFullYear())
    const { data, isLoading, error } = useStats(year)
    const saveSettings = useSaveSettings()
    const [editingGoal, setEditingGoal] = useState(false)
    const [goalInput, setGoalInput] = useState('')

    if (isLoading) return <div className={styles.page}><Skeleton width="40%" height={32} /><Skeleton height={160} /><Skeleton height={220} /></div>
    if (error) return <p className={styles.muted}>{errorMessage(error, 'Couldn’t load your reading stats.')}</p>

    const max = Math.max(1, ...data.byMonth)
    const isThisYear = year === new Date().getFullYear()
    const goalPct = data.goal ? Math.min(100, Math.round((data.finishedCount / data.goal) * 100)) : null
    // Expected pace by today (this year only)
    const dayOfYear = Math.floor((Date.now() - Date.UTC(year, 0, 1)) / 86400000) + 1
    const expected = data.goal && isThisYear ? Math.round((data.goal * dayOfYear) / 365) : null

    const saveGoal = (e) => {
        e.preventDefault()
        saveSettings.mutate({ readingGoal: goalInput }, {
            onSuccess: (s) => { setEditingGoal(false); toast.success(s.readingGoal ? `Goal set: ${s.readingGoal} books a year` : 'Goal removed') },
            onError: (err) => toast.error(errorMessage(err)),
        })
    }

    return (
        <div className={styles.page}>
            <div className={styles.titleRow}>
                <h1 className={styles.title}>Reading</h1>
                <label className={styles.yearPick}>
                    <span className="sr-only">Year</span>
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={styles.select}>
                        {data.years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </label>
            </div>

            {/* Headline numbers */}
            <section className={styles.tiles} aria-label={`${year} summary`}>
                <div className={styles.tile}>
                    <span className={styles.tileValue}>{data.finishedCount}</span>
                    <span className={styles.tileLabel}>books finished in {year}</span>
                </div>
                <div className={styles.tile}>
                    <span className={styles.tileValue}>{data.pagesRead.toLocaleString()}</span>
                    <span className={styles.tileLabel}>pages read</span>
                </div>
                <div className={styles.tile}>
                    <span className={styles.tileValue}>{data.totals.statuses['Currently Reading'] || 0}</span>
                    <span className={styles.tileLabel}><Link to="/library?status=Currently%20Reading">reading now</Link></span>
                </div>
            </section>

            {/* Goal */}
            <section className={styles.card} aria-label="Reading goal">
                <div className={styles.cardHead}>
                    <h2 className={styles.h2}>{year} goal</h2>
                    {isOwner && !editingGoal && (
                        <button type="button" className={styles.textButton} onClick={() => { setGoalInput(data.goal || ''); setEditingGoal(true) }}>
                            {data.goal ? 'Change' : 'Set a goal'}
                        </button>
                    )}
                </div>
                {editingGoal ? (
                    <form className={styles.goalForm} onSubmit={saveGoal}>
                        <label htmlFor="goal" className={styles.muted}>Books per year</label>
                        <input id="goal" type="number" min="0" max="1000" inputMode="numeric" className={styles.goalInput} value={goalInput} onChange={(e) => setGoalInput(e.target.value)} autoFocus />
                        <button type="submit" className={buttonClass('primary')} disabled={saveSettings.isPending}>Save</button>
                        <button type="button" className={buttonClass('secondary')} onClick={() => setEditingGoal(false)}>Cancel</button>
                    </form>
                ) : data.goal ? (
                    <>
                        <p className={styles.goalText}>
                            <strong>{data.finishedCount}</strong> of {data.goal} books ({goalPct}%)
                            {expected !== null && (
                                <span className={styles.muted}>
                                    {' · '}{data.finishedCount >= expected ? 'on track' : `${expected - data.finishedCount} behind pace`}
                                </span>
                            )}
                        </p>
                        <div className={styles.goalBar} role="progressbar" aria-valuemin={0} aria-valuemax={data.goal} aria-valuenow={data.finishedCount} aria-label="Goal progress">
                            <span style={{ width: `${goalPct}%` }} />
                        </div>
                    </>
                ) : (
                    <p className={styles.muted}>No goal set{isOwner ? '' : ' yet'}.</p>
                )}
            </section>

            {/* Books finished per month: one series, so no legend; values labelled; table for screen readers */}
            <section className={styles.card} aria-labelledby="by-month">
                <h2 className={styles.h2} id="by-month">Books finished per month</h2>
                {data.finishedCount === 0 ? (
                    <p className={styles.muted}>
                        No books finished in {year} yet. When you mark a book “Read”, it shows up here.
                    </p>
                ) : (
                    <>
                        <div className={styles.chart} aria-hidden="true">
                            {data.byMonth.map((n, i) => (
                                <div key={MONTHS[i]} className={styles.col} title={`${MONTHS[i]} ${year}: ${n} book${n === 1 ? '' : 's'}`}>
                                    <span className={styles.value}>{n || ''}</span>
                                    <span className={styles.barTrack}>
                                        <span className={styles.bar} style={{ height: `${(n / max) * 100}%` }} />
                                    </span>
                                    <span className={styles.month}>{MONTHS[i]}</span>
                                </div>
                            ))}
                        </div>
                        <table className="sr-only">
                            <caption>Books finished per month in {year}</caption>
                            <thead><tr><th>Month</th><th>Books</th></tr></thead>
                            <tbody>{data.byMonth.map((n, i) => <tr key={MONTHS[i]}><td>{MONTHS[i]}</td><td>{n}</td></tr>)}</tbody>
                        </table>
                    </>
                )}
            </section>

            {data.finished.length > 0 && (
                <section className={styles.card} aria-labelledby="finished">
                    <h2 className={styles.h2} id="finished">Finished in {year}</h2>
                    <ul className={styles.finishedList}>
                        {data.finished.map((b) => (
                            <li key={b._id}>
                                <Link to={`/books/${b._id}`} className={styles.finishedRow}>
                                    <span className={styles.finishedTitle}>{b.title}</span>
                                    <span className={styles.muted}>{[b.author?.firstName, b.author?.lastName].filter(Boolean).join(' ')}</span>
                                    <span className={styles.finishedMeta}>
                                        <Rating value={b.rating} size="sm" />
                                        <span className={styles.muted}>{formatDay(b.finishedAt)}</span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Library at a glance */}
            <section className={styles.twoCol}>
                <div className={styles.card}>
                    <h2 className={styles.h2}>Your library</h2>
                    <ul className={styles.kv}>
                        <li><span>Books</span><strong>{data.totals.books}</strong></li>
                        {data.totals.wishlist > 0 && <li><Link to="/library?status=wishlist">Wishlist</Link><strong>{data.totals.wishlist}</strong></li>}
                        {Object.entries(data.totals.statuses).filter(([k]) => k !== 'none').map(([k, n]) => (
                            <li key={k}><Link to={`/library?status=${encodeURIComponent(k)}`}>{STATUS_LABELS[k] || k}</Link><strong>{n}</strong></li>
                        ))}
                        {data.totals.averageRating && <li><span>Average rating</span><strong>{data.totals.averageRating} / 5</strong></li>}
                    </ul>
                </div>
                <div className={styles.card}>
                    <h2 className={styles.h2}>Most collected</h2>
                    <ul className={styles.kv}>
                        {data.topAuthors.map((a) => <li key={a.name}><span>{a.name}</span><strong>{a.count}</strong></li>)}
                    </ul>
                    {data.topGenres.length > 0 && (
                        <ul className={styles.kv}>
                            {data.topGenres.map((g) => (
                                <li key={g.name}><Link to={`/genres/${encodeURIComponent(g.name.toLowerCase())}`}>{g.name}</Link><strong>{g.count}</strong></li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    )
}

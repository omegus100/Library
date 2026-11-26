import React, { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../api/client'
import { keys } from '../api/hooks'
import { useToast } from '../components/Toast'
import { buttonClass } from '../components/Buttons'
import styles from './Settings.module.css'

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

// Settings → Your data → Covers: find covers for every book that has none (Calibre, Open Library, Google Books)
export default function CoverFinder() {
    const toast = useToast()
    const qc = useQueryClient()
    const { data } = useQuery({ queryKey: ['covers', 'missing'], queryFn: () => api.get('/covers/missing').then((r) => r.data) })
    const [run, setRun] = useState(null) // { checked, found, total, sources }
    const stop = useRef(false)

    const missing = data?.count ?? 0
    if (!missing && !run) return null

    const start = async () => {
        stop.current = false
        const progress = { checked: 0, found: 0, total: missing, sources: {}, done: false }
        setRun({ ...progress })
        let after = ''
        let googleBlocked = false
        try {
            do {
                const { data: r } = await api.post('/covers/fill', { after, googleBlocked })
                for (const item of r.results) {
                    progress.checked++
                    if (item.source) { progress.found++; progress.sources[item.source] = (progress.sources[item.source] || 0) + 1 }
                }
                setRun({ ...progress })
                after = r.next
                googleBlocked = r.googleBlocked
            } while (after && !stop.current)
            toast.success(progress.found ? `Found ${plural(progress.found, 'cover')}` : 'No new covers found')
        } catch (err) {
            toast.error(errorMessage(err, 'Cover search stopped.'))
        } finally {
            setRun({ ...progress, done: true })
            qc.invalidateQueries({ queryKey: keys.books })
            qc.invalidateQueries({ queryKey: ['covers'] })
        }
    }

    const running = run && !run.done
    const sources = run ? Object.entries(run.sources).map(([s, n]) => `${n} from ${s}`).join(', ') : ''

    return (
        <div className={styles.block}>
            <h3 className={styles.h3}>Covers</h3>
            <p className={styles.muted}>
                {missing ? `${plural(missing, 'book')} ${missing === 1 ? 'has' : 'have'} no cover.` : 'Every book has a cover.'}{' '}
                Looks in your Calibre ebooks first, then Open Library, then Google Books. Only the title, author and ISBN are sent.
            </p>
            {run && (
                <p className={styles.muted} aria-live="polite">
                    {running ? `Checked ${run.checked} of ${run.total}…` : `Checked ${run.checked}.`} Found {plural(run.found, 'cover')}{sources ? ` (${sources})` : ''}.
                </p>
            )}
            <div className={styles.row}>
                {!running && missing > 0 && (
                    <button type="button" className={buttonClass('secondary')} onClick={start}>Find missing covers</button>
                )}
                {running && (
                    <button type="button" className={buttonClass('secondary')} onClick={() => { stop.current = true }}>Stop</button>
                )}
            </div>
        </div>
    )
}

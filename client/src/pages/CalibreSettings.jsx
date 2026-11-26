import React, { useEffect, useMemo, useState } from 'react'
import { errorMessage } from '../api/client'
import { useCalibre, useCalibreNotInLibrary, useSaveCalibre, useSyncCalibre, useAddFromCalibre, testCalibre } from '../api/hooks'
import { useToast } from '../components/Toast'
import { TextInput, SearchInput } from '../components/FormOptions'
import { buttonClass } from '../components/Buttons'
import styles from './Settings.module.css'
import own from './CalibreSettings.module.css'

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

function ago(iso) {
    if (!iso) return ''
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (min < 1) return 'just now'
    if (min < 60) return `${min} min ago`
    if (min < 60 * 24) return `${Math.round(min / 60)} h ago`
    return new Date(iso).toLocaleDateString()
}

// Settings → Calibre. Everything is stored in the app; the folder is the Calibre library as the container sees it.
export default function CalibreSettings() {
    const toast = useToast()
    const { data: cfg, isLoading } = useCalibre()
    const save = useSaveCalibre()
    const sync = useSyncCalibre()
    const [form, setForm] = useState({ path: '', webUrl: '' })
    const [testing, setTesting] = useState(false)
    const [picking, setPicking] = useState(false)

    useEffect(() => {
        if (cfg) setForm({ path: cfg.path || cfg.defaultPath, webUrl: cfg.webUrl || '' })
    }, [cfg])

    if (isLoading || !cfg) return null
    const set = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
    const dirty = form.path !== (cfg.path || cfg.defaultPath) || form.webUrl !== (cfg.webUrl || '')
    const r = cfg.lastResult

    const test = async () => {
        setTesting(true)
        try {
            const { books } = await testCalibre(form.path)
            toast.success(`Found a Calibre library with ${plural(books, 'book')}`)
        } catch (err) {
            toast.error(errorMessage(err, 'Couldn’t open that folder.'))
        } finally {
            setTesting(false)
        }
    }

    const submit = (enabled) => save.mutate({ ...form, enabled }, {
        onSuccess: (res) => {
            if (res.sync?.error) toast.error(`Saved, but the sync failed: ${res.sync.error}`)
            else if (res.sync) toast.success(`Connected: ${plural(res.sync.books, 'ebook')}, ${res.sync.linked} linked to your books`)
            else toast.success(enabled ? 'Saved' : 'Calibre turned off')
        },
        onError: (err) => toast.error(errorMessage(err, 'Couldn’t save.')),
    })

    const runSync = () => sync.mutate(undefined, {
        onSuccess: (res) => toast.success(res.newlyLinked
            ? `Linked ${plural(res.newlyLinked, 'more book')} to Calibre`
            : `Up to date: ${plural(res.books, 'ebook')}, ${res.linked} linked`),
        onError: (err) => toast.error(errorMessage(err, 'Sync failed.')),
    })

    return (
        <section className={styles.card} aria-labelledby="calibre">
            <div className={own.head}>
                <h2 id="calibre" className={styles.h2}>Calibre ebooks</h2>
                <span className={`${own.badge} ${cfg.enabled ? own.on : ''}`}>{cfg.enabled ? 'On' : 'Off'}</span>
            </div>
            <p className={styles.muted}>
                Marks which of your books you also have as ebooks, and can add your Calibre ebooks to the catalog.
                Read-only: nothing in Calibre or Calibre-Web is ever changed.
            </p>

            {cfg.enabled && (
                <div className={own.status}>
                    {r && <p><strong>{plural(r.books, 'ebook')}</strong> in Calibre · <strong>{r.linked}</strong> linked to your books
                        {r.missing > 0 && <> · {r.missing} no longer in Calibre</>}</p>}
                    <p className={styles.muted}>
                        {cfg.lastSync ? `Last synced ${ago(cfg.lastSync)}. Syncs every 6 hours.` : 'Not synced yet.'}
                    </p>
                    {cfg.lastError && (!cfg.lastSync || cfg.lastError.at > cfg.lastSync) && (
                        <p className={own.error}>Last sync failed: {cfg.lastError.message}</p>
                    )}
                </div>
            )}

            <div className={styles.form}>
                <TextInput label="Calibre library folder" name="path" value={form.path} onChange={set}
                    hint={`The folder with metadata.db, as the container sees it. With the Docker setup this is ${cfg.defaultPath}.`} />
                <TextInput label="Calibre-Web address (optional)" name="webUrl" type="url" value={form.webUrl} onChange={set}
                    placeholder="http://your-nas:8083" hint="Adds “Read in Calibre-Web” links on book pages." />
            </div>

            <div className={styles.row}>
                {!cfg.enabled && (
                    <button type="button" className={buttonClass('primary')} onClick={() => submit(true)} disabled={save.isPending}>
                        {save.isPending ? 'Connecting…' : 'Turn on and sync'}
                    </button>
                )}
                {cfg.enabled && dirty && (
                    <button type="button" className={buttonClass('primary')} onClick={() => submit(true)} disabled={save.isPending}>Save</button>
                )}
                {cfg.enabled && !dirty && (
                    <button type="button" className={buttonClass('primary')} onClick={runSync} disabled={sync.isPending}>
                        {sync.isPending ? 'Syncing…' : 'Sync now'}
                    </button>
                )}
                <button type="button" className={buttonClass('secondary')} onClick={test} disabled={testing}>{testing ? 'Checking…' : 'Test folder'}</button>
                {cfg.enabled && (
                    <button type="button" className={buttonClass('secondary')} onClick={() => submit(false)} disabled={save.isPending}>Turn off</button>
                )}
            </div>

            {cfg.enabled && r?.notInLibrary > 0 && (
                <div className={styles.block}>
                    <h3 className={styles.h3}>Not in your library yet</h3>
                    <p className={styles.muted}>{plural(r.notInLibrary, 'ebook')} in Calibre {r.notInLibrary === 1 ? 'has' : 'have'} no entry in your catalog.</p>
                    {picking
                        ? <AddPicker onDone={() => setPicking(false)} />
                        : <button type="button" className={buttonClass('secondary')} style={{ alignSelf: 'flex-start' }} onClick={() => setPicking(true)}>Choose ebooks to add…</button>}
                </div>
            )}
        </section>
    )
}

function AddPicker({ onDone }) {
    const toast = useToast()
    const { data: items = [], isLoading } = useCalibreNotInLibrary(true)
    const add = useAddFromCalibre()
    const [q, setQ] = useState('')
    const [chosen, setChosen] = useState(() => new Set())

    const shown = useMemo(() => {
        const t = q.trim().toLowerCase()
        if (!t) return items
        return items.filter((i) => [i.title, i.series, ...i.authors].some((v) => v && v.toLowerCase().includes(t)))
    }, [items, q])

    const toggle = (id) => setChosen((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
    })
    const allShown = shown.length > 0 && shown.every((i) => chosen.has(i.calibreId))
    const toggleShown = () => setChosen((prev) => {
        const next = new Set(prev)
        shown.forEach((i) => (allShown ? next.delete(i.calibreId) : next.add(i.calibreId)))
        return next
    })

    const submit = () => add.mutate([...chosen], {
        onSuccess: ({ added, linked }) => {
            toast.success(`Added ${plural(added, 'book')}${linked ? `, linked ${linked} you already had` : ''}`)
            setChosen(new Set())
            onDone()
        },
        onError: (err) => toast.error(errorMessage(err, 'Couldn’t add those books.')),
    })

    if (isLoading) return <p className={styles.muted}>Loading…</p>

    return (
        <div className={own.picker}>
            <SearchInput id="calibre-filter" className={own.filter} label="Filter ebooks" placeholder="Filter by title, author or series" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className={own.toolbar}>
                <label className={own.check}>
                    <input type="checkbox" checked={allShown} onChange={toggleShown} />
                    {q ? `Select all ${shown.length} shown` : `Select all ${shown.length}`}
                </label>
                <span className={styles.muted}>{chosen.size} selected</span>
            </div>
            <ul className={own.list}>
                {shown.map((i) => (
                    <li key={i.calibreId}>
                        <label className={own.item}>
                            <input type="checkbox" checked={chosen.has(i.calibreId)} onChange={() => toggle(i.calibreId)} />
                            <span className={own.text}>
                                <span className={own.title}>{i.title}</span>
                                <span className={styles.muted}>
                                    {[i.authors.join(', '), i.series && `${i.series}${i.seriesIndex ? ` #${i.seriesIndex}` : ''}`].filter(Boolean).join(' · ')}
                                </span>
                            </span>
                        </label>
                    </li>
                ))}
                {!shown.length && <li className={styles.muted}>No ebooks match.</li>}
            </ul>
            <p className={styles.muted}>Each becomes an eBook in your catalog with Calibre’s title, author, series, ISBN, description and cover.</p>
            <div className={styles.row}>
                <button type="button" className={buttonClass('primary')} onClick={submit} disabled={!chosen.size || add.isPending}>
                    {add.isPending ? 'Adding…' : `Add ${plural(chosen.size, 'book')}`}
                </button>
                <button type="button" className={buttonClass('secondary')} onClick={onDone} disabled={add.isPending}>Cancel</button>
            </div>
        </div>
    )
}

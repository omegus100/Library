import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api, errorMessage } from '../api/client'
import { useImport } from '../api/hooks'
import { useToast } from '../components/Toast'
import { TextInput } from '../components/FormOptions'
import { buttonClass } from '../components/Buttons'
import CalibreSettings from './CalibreSettings'
import ImportPreview from './ImportPreview'
import CoverFinder from './CoverFinder'
import styles from './Settings.module.css'

const readTheme = () => { try { return localStorage.getItem('theme') || 'system' } catch { return 'system' } }

function applyTheme(value) {
    try {
        if (value === 'system') {
            localStorage.removeItem('theme')
            document.documentElement.removeAttribute('data-theme')
        } else {
            localStorage.setItem('theme', value)
            document.documentElement.setAttribute('data-theme', value)
        }
    } catch { document.documentElement.setAttribute('data-theme', value === 'system' ? '' : value) }
}

export default function Settings() {
    const { user, isOwner, logout, replaceToken } = useAuth()
    const toast = useToast()
    const [theme, setTheme] = useState(readTheme)

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>Settings</h1>

            <section className={styles.card} aria-labelledby="appearance">
                <h2 id="appearance" className={styles.h2}>Appearance</h2>
                <div className={styles.segment} role="radiogroup" aria-label="Theme">
                    {[['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([value, label]) => (
                        <button key={value} type="button" role="radio" aria-checked={theme === value} className={styles.segmentButton}
                            onClick={() => { applyTheme(value); setTheme(value) }}>
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            <section className={styles.card} aria-labelledby="account">
                <h2 id="account" className={styles.h2}>Account</h2>
                {isOwner ? (
                    <>
                        <p className={styles.muted}>Signed in as <strong>{user.email}</strong></p>
                        <div className={styles.row}>
                            <button type="button" className={buttonClass('secondary')} onClick={() => { logout(); toast.show('Signed out') }}>Sign out</button>
                            <button type="button" className={buttonClass('secondary')} onClick={async () => {
                                if (!window.confirm('Sign out on every device, including this one?')) return
                                try { await api.post('/auth/logout-everywhere'); logout(); toast.show('Signed out everywhere') } catch (err) { toast.error(errorMessage(err)) }
                            }}>Sign out everywhere</button>
                        </div>
                        <ChangePassword onDone={(token) => { replaceToken(token); toast.success('Password changed. Other devices were signed out.') }} />
                    </>
                ) : (
                    <p className={styles.muted}>You’re browsing as a visitor. <Link to="/login?next=/settings">Sign in</Link> to add or change books.</p>
                )}
            </section>

            {isOwner && <CalibreSettings />}

            {isOwner && <DataSection />}

            <section className={styles.card} aria-labelledby="browse">
                <h2 id="browse" className={styles.h2}>Browse</h2>
                <div className={styles.links}>
                    <Link to="/authors">Authors</Link>
                    <Link to="/series">Series</Link>
                    <Link to="/genres">Genres</Link>
                    <Link to="/format">Formats</Link>
                    <Link to="/library?status=wishlist">Wishlist</Link>
                    <Link to="/stats">Reading stats and goal</Link>
                </div>
            </section>
        </div>
    )
}

function ChangePassword({ onDone }) {
    const toast = useToast()
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
    const [busy, setBusy] = useState(false)
    const set = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

    if (!open) return <button type="button" className={styles.textButton} onClick={() => setOpen(true)}>Change password</button>

    const submit = async (e) => {
        e.preventDefault()
        if (form.newPassword !== form.confirm) { toast.error('The new passwords don’t match.'); return }
        setBusy(true)
        try {
            const { data } = await api.post('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword })
            onDone(data.token)
            setOpen(false)
            setForm({ currentPassword: '', newPassword: '', confirm: '' })
        } catch (err) {
            toast.error(errorMessage(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <form className={styles.form} onSubmit={submit}>
            <TextInput label="Current password" name="currentPassword" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set} />
            <TextInput label="New password" name="newPassword" type="password" autoComplete="new-password" value={form.newPassword} onChange={set} hint="At least 10 characters" />
            <TextInput label="New password again" name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set} />
            <div className={styles.row}>
                <button type="submit" className={buttonClass('primary')} disabled={busy || form.newPassword.length < 10}>Change password</button>
                <button type="button" className={buttonClass('secondary')} onClick={() => setOpen(false)}>Cancel</button>
            </div>
        </form>
    )
}

function DataSection() {
    const toast = useToast()
    const importer = useImport()
    const [csv, setCsv] = useState('')
    const [fileName, setFileName] = useState('')
    const [preview, setPreview] = useState(null)

    const download = async (format) => {
        try {
            const res = await api.get('/export', { params: { format }, responseType: 'blob' })
            const url = URL.createObjectURL(res.data)
            const a = document.createElement('a')
            a.href = url
            a.download = `library-${new Date().toISOString().slice(0, 10)}.${format}`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            toast.error(errorMessage(err, 'Export failed.'))
        }
    }

    const onFile = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFileName(file.name)
        const text = await file.text()
        setCsv(text)
        importer.mutate({ csv: text, dryRun: true }, {
            onSuccess: setPreview,
            onError: (err) => { setPreview(null); toast.error(errorMessage(err, 'Couldn’t read that file.')) },
        })
    }

    const reset = () => { setPreview(null); setCsv(''); setFileName('') }
    const runImport = ({ wishlist, fillExisting }) =>
        importer.mutate({ csv, dryRun: false, wishlist, fillExisting }, {
            onSuccess: (r) => {
                const parts = [`Imported ${r.created} book${r.created === 1 ? '' : 's'}`]
                if (r.wishlistCount) parts.push(`${r.wishlistCount} on the wishlist`)
                if (r.fill.count && fillExisting) parts.push(`filled in ${r.fill.count}`)
                toast.success(parts.join(', '))
                reset()
            },
            onError: (err) => toast.error(errorMessage(err, 'Import failed.')),
        })

    return (
        <section className={styles.card} aria-labelledby="data">
            <h2 id="data" className={styles.h2}>Your data</h2>

            <div className={styles.block}>
                <h3 className={styles.h3}>Export</h3>
                <p className={styles.muted}>Download everything (covers not included). CSV opens in Excel or Google Sheets.</p>
                <div className={styles.row}>
                    <button type="button" className={buttonClass('secondary')} onClick={() => download('csv')}>Download CSV</button>
                    <button type="button" className={buttonClass('secondary')} onClick={() => download('json')}>Download JSON (full backup)</button>
                </div>
            </div>

            <div className={styles.block}>
                <h3 className={styles.h3}>Import</h3>
                <p className={styles.muted}>
                    From Goodreads: <em>My Books → Import and export → Export library</em>, then pick that CSV here. This app’s own CSV export works too.
                    Rated books are marked read; to-read, want-to-buy and potential-reads go to your wishlist. Books you already have aren’t added twice.
                </p>
                <label className={buttonClass('secondary')} style={{ alignSelf: 'flex-start' }}>
                    Choose CSV file…
                    <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
                </label>
                {fileName && <span className={styles.muted}>{fileName}</span>}
                {importer.isPending && !preview && <span className={styles.muted}>Reading…</span>}
                {preview?.dryRun && <ImportPreview key={fileName} preview={preview} busy={importer.isPending} onImport={runImport} onCancel={reset} />}
            </div>

            <CoverFinder />
        </section>
    )
}

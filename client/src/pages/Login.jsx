import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api, errorMessage } from '../api/client'
import { TextInput } from '../components/FormOptions'
import { buttonClass } from '../components/Buttons'
import styles from '../components/FormPage.module.css'

export default function Login() {
    const { login, isOwner } = useAuth()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const next = params.get('next') || '/library'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [setupNeeded, setSetupNeeded] = useState(false)

    useEffect(() => {
        api.get('/auth/status').then(({ data }) => setSetupNeeded(data.setupNeeded)).catch(() => {})
    }, [])

    if (isOwner) return <Navigate to={next} replace />

    const submit = async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
            await login(email, password)
            navigate(next.startsWith('/') ? next : '/library', { replace: true })
        } catch (err) {
            setError(errorMessage(err, 'Sign-in failed. Try again.'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>Sign in</h1>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Sign in to add, edit or remove books. Anyone can browse.</p>

            {setupNeeded && (
                <div className={styles.card} role="note">
                    <strong>No owner account yet.</strong>
                    <span>Create one from the <code>server</code> folder:</span>
                    <code>node scripts/create-owner.js you@example.com</code>
                </div>
            )}

            <form onSubmit={submit} className={styles.card}>
                <TextInput label="Email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
                <TextInput label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p role="alert" style={{ margin: 0, color: 'var(--color-danger)' }}>{error}</p>}
                <div className={styles.actions}>
                    <button type="submit" className={buttonClass('primary')} disabled={busy || !email || !password}>
                        {busy ? 'Signing in…' : 'Sign in'}
                    </button>
                </div>
            </form>
        </div>
    )
}

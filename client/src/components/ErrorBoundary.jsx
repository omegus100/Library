import React from 'react'
import { buttonClass } from './Buttons'

// If a page crashes, show a message instead of a blank screen. The header stays usable.
// `resetKey` (the current path) clears the error when you navigate elsewhere.
export default class ErrorBoundary extends React.Component {
    state = { error: null }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        console.error('Page crashed:', error, info?.componentStack)
    }

    componentDidUpdate(prev) {
        if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
    }

    render() {
        if (!this.state.error) return this.props.children
        return (
            <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>Something went wrong on this page</h1>
                <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                    Reloading usually fixes it. If you just updated the app, restart the server too.
                </p>
                <code style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', overflowWrap: 'anywhere' }}>{String(this.state.error?.message || this.state.error)}</code>
                <button type="button" className={buttonClass('primary')} style={{ alignSelf: 'flex-start' }} onClick={() => window.location.reload()}>Reload</button>
            </div>
        )
    }
}

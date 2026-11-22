import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import styles from './Toast.module.css'

const ToastContext = createContext({ show: () => {} })

// Small on-page notices that replace alert(). toast.success('Saved'), toast.error('...'), toast.show(msg)
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const nextId = useRef(1)

    const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

    const show = useCallback((message, { tone = 'info', duration = 4000, action } = {}) => {
        const id = nextId.current++
        setToasts((list) => [...list.slice(-3), { id, message, tone, action }])
        if (duration) setTimeout(() => dismiss(id), duration)
        return id
    }, [dismiss])

    const api = useMemo(() => ({
        show,
        success: (m, o) => show(m, { ...o, tone: 'success' }),
        error: (m, o) => show(m, { duration: 7000, ...o, tone: 'error' }),
        dismiss,
    }), [show, dismiss])

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className={styles.region} role="region" aria-label="Notifications">
                {toasts.map((t) => (
                    <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`} role={t.tone === 'error' ? 'alert' : 'status'}>
                        <span className={styles.message}>{t.message}</span>
                        {t.action && (
                            <button type="button" className={styles.action} onClick={() => { t.action.onClick(); dismiss(t.id) }}>
                                {t.action.label}
                            </button>
                        )}
                        <button type="button" className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => useContext(ToastContext)

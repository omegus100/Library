import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getToken, setToken } from '../api/client'

const AuthContext = createContext(null)

// Who is signed in. Visitors can browse; only the signed-in owner can change things.
export function AuthProvider({ children }) {
    const qc = useQueryClient()
    const [user, setUser] = useState(null)
    const [checking, setChecking] = useState(Boolean(getToken()))

    // On load: if a token is stored, ask the server who it belongs to
    useEffect(() => {
        if (!getToken()) return
        api.get('/auth/me')
            .then(({ data }) => setUser(data.user))
            .catch(() => { setToken(''); setUser(null) })
            .finally(() => setChecking(false))
    }, [])

    // A request came back 401 with a stored token: it expired
    useEffect(() => {
        const onExpired = () => setUser(null)
        window.addEventListener('auth:expired', onExpired)
        return () => window.removeEventListener('auth:expired', onExpired)
    }, [])

    const login = useCallback(async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password })
        setToken(data.token)
        setUser(data.user)
        qc.invalidateQueries() // private fields (notes, loans) now visible
        return data.user
    }, [qc])

    const logout = useCallback(() => {
        setToken('')
        setUser(null)
        qc.invalidateQueries()
    }, [qc])

    const value = useMemo(() => ({
        user,
        checking,
        isOwner: user?.role === 'owner',
        login,
        logout,
        replaceToken: (token) => setToken(token),
    }), [user, checking, login, logout])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

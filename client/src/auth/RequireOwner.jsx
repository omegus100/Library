import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

// Wrap pages that change data (add, edit). Visitors are sent to sign in, then back here.
export default function RequireOwner({ children }) {
    const { isOwner, checking } = useAuth()
    const location = useLocation()
    if (checking) return null
    if (!isOwner) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
    return children
}

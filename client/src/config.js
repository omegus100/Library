// Where the API lives. The only place the client reads it.
//
// - Empty (the default): relative paths like /api/books. Works when the same server
//   serves the site and the API (Docker/NAS), and in dev via the Vite proxy.
// - Set VITE_API_BASE_URL when the API is on another host (today: Render, while the
//   site is on Netlify). No trailing slash.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

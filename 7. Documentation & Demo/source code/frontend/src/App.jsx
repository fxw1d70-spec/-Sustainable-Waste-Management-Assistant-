import { NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import Scanner from './pages/Scanner.jsx'
import MapPage from './pages/MapPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'

function UserMenu() {
  const { user, logout, authEnabled } = useAuth()
  if (!authEnabled || !user) return null

  const label = user.displayName || user.email || 'Account'
  const initial = label.charAt(0).toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full ring-2 ring-brand-500"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate text-sm text-brand-50 sm:block">
          {label}
        </span>
      </div>
      <button
        onClick={logout}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-brand-100 transition hover:bg-brand-600/60 hover:text-white"
      >
        Sign out
      </button>
    </div>
  )
}

function Navbar() {
  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition ${
      isActive
        ? 'bg-white text-brand-700 shadow-sm'
        : 'text-brand-50 hover:bg-brand-600/60'
    }`

  return (
    <header className="bg-brand-700">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-white">
          <span className="text-2xl">♻️</span>
          <div>
            <h1 className="text-lg font-bold leading-none">WasteGuide AI</h1>
            <p className="text-xs text-brand-100">
              Sustainable Waste Management Assistant
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex gap-2">
            <NavLink to="/" end className={linkClass}>
              Scanner
            </NavLink>
            <NavLink to="/map" className={linkClass}>
              Map
            </NavLink>
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
          </nav>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

export default function App() {
  const { user, loading, authEnabled } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">♻️</div>
          <p className="mt-2 text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    )
  }

  // When Firebase auth is configured, the whole app sits behind sign-in.
  if (authEnabled && !user) return <Login />

  return (
    <div className="min-h-full">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Scanner />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        WasteGuide AI · Smart-city waste assistant · Built with React, Flask & Groq
      </footer>
    </div>
  )
}

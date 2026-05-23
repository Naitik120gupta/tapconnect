// src/App.jsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useStore } from './stores/useStore'

// Pages
import AuthPage from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import HomePage from './pages/HomePage'
import TapPage from './pages/TapPage'
import MatchPage from './pages/MatchPage'
import ConnectionsPage from './pages/ConnectionsPage'
import ProfilePage from './pages/ProfilePage'
import JoinPage from './pages/JoinPage'

// Layout
import AppShell from './components/AppShell'

const ProtectedRoute = ({ children }) => {
  const { user, authLoading } = useStore()
  if (authLoading) return <Loader />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

const Loader = () => (
  <div style={{
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)'
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: '2px solid var(--border2)',
      borderTopColor: 'var(--accent)',
      animation: 'spin 0.8s linear infinite'
    }} />
  </div>
)

export default function App() {
  const { setUser, setAuthLoading, loadProfile } = useStore()

  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null
        setUser(user)
        if (user) await loadProfile(user.id)
        setAuthLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Onboarding (auth required but no profile yet) */}
        <Route path="/onboarding" element={
          <ProtectedRoute><OnboardingPage /></ProtectedRoute>
        } />

        {/* Main app */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }>
          <Route index element={<HomePage />} />
          <Route path="tap" element={<TapPage />} />
          <Route path="match" element={<MatchPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* NFC deep link — /join/:code */}
        <Route path="/join/:code" element={<JoinPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

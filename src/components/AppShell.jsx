// src/components/AppShell.jsx
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import InstallPrompt from './InstallPrompt'

const NAV = [
  { path: '/',            icon: '⚡', label: 'Home' },
  { path: '/connections', icon: '🤝', label: 'Network' },
  { path: '/profile',     icon: '👤', label: 'Profile' },
]

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useStore()

  if (!profile) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
            tap<span style={{ color: 'var(--accent)' }}>.</span>connect
          </div>
          <button onClick={() => navigate('/onboarding')} style={btnStyle}>
            Set up your profile →
          </button>
        </div>
      </div>
    )
  }

  const hideNav = ['/tap', '/match'].includes(location.pathname)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: hideNav ? 0 : 72 }}>
        <Outlet />
      </div>

      {/* PWA install prompt — sits just above the nav */}
      {!hideNav && <InstallPrompt />}

      {!hideNav && (
        <nav style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          background: 'rgba(8,8,16,0.95)',
          borderTop: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          zIndex: 100,
        }}>
          {NAV.map(({ path, icon, label }) => {
            const active = location.pathname === path
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                style={{
                  flex: 1, padding: '12px 0 16px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4,
                  color: active ? 'var(--accent)' : 'var(--text3)',
                  transition: 'color var(--transition)',
                }}
              >
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{
                  fontSize: 10, fontFamily: 'DM Mono', letterSpacing: '0.06em',
                  fontWeight: active ? 500 : 400
                }}>{label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}

const btnStyle = {
  background: 'var(--accent)',
  color: '#000',
  fontFamily: 'Syne',
  fontWeight: 700,
  fontSize: 15,
  padding: '12px 28px',
  borderRadius: 50,
  border: 'none',
  cursor: 'pointer'
}

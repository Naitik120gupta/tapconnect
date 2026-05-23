// src/pages/HomePage.jsx
import { useNavigate } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import TapScreen from '../components/TapScreen'

const INTENT_LABELS = {
  networking: '🌐 Networking',
  hiring: '🔍 Hiring',
  fundraising: '💰 Fundraising',
  cofounder: '🤝 Co-founder Hunt',
  partnerships: '🔗 Partnerships',
}

export default function HomePage() {
  const { profile, connections } = useStore()
  if (!profile) return null

  return (
    <div style={{ padding: '24px 20px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>
          tap<span style={{ color: 'var(--accent)' }}>.</span>connect
        </div>
        <div style={{
          background: 'rgba(78,203,141,0.12)', border: '1px solid rgba(78,203,141,0.3)',
          borderRadius: 20, padding: '4px 12px',
          fontSize: 11, color: 'var(--green)', fontFamily: 'DM Mono',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
          {connections.length} connected
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '14px 18px',
        marginBottom: 28,
      }}>
        <Avatar profile={profile} size={50} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>{profile.name}</div>
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'DM Mono', marginTop: 2 }}>
            {profile.role} · {profile.company}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 11, padding: '2px 10px', borderRadius: 20,
              background: 'rgba(232,197,71,0.12)', color: 'var(--accent)',
              border: '1px solid rgba(232,197,71,0.25)', fontFamily: 'DM Mono'
            }}>
              {INTENT_LABELS[profile.intent] || '🌐 Networking'}
            </span>
          </div>
        </div>
      </div>

      <TapScreen />
    </div>
  )
}

export function Avatar({ profile, size = 44 }) {
  const initials = (profile?.name || '?')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const color = profile?.avatar_color || '#e8c547'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}22`, border: `2px solid ${color}66`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Syne', fontWeight: 800, fontSize: size * 0.3,
      color, flexShrink: 0
    }}>{initials}</div>
  )
}

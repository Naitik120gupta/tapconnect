// src/pages/ProfilePage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import { upsertProfile, signOut } from '../lib/supabase'
import { Avatar } from './HomePage'

const INTENT_LABELS = {
  networking: '🌐 Open Networking',
  hiring: '🔍 Hiring',
  fundraising: '💰 Fundraising',
  cofounder: '🤝 Co-founder Hunt',
  partnerships: '🔗 Partnerships',
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, setProfile, connections } = useStore()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(profile || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSave = async () => {
    setSaving(true)
    const { data } = await upsertProfile({ ...form, id: user.id, updated_at: new Date().toISOString() })
    if (data) {
      setProfile(data)
      setForm(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
    setEditing(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  if (!profile) return null

  return (
    <div style={{ padding: '24px 20px 40px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>
          My Profile
        </h1>
        {!editing && (
          <button onClick={() => setEditing(true)}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '7px 16px', color: 'var(--text2)',
              fontFamily: 'DM Mono', fontSize: 12, cursor: 'pointer'
            }}>Edit</button>
        )}
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 12, marginBottom: 24
      }}>
        {[
          ['🤝', connections.length, 'connections'],
          ['⚡', connections.length * 2 + 1, 'taps total'],
        ].map(([icon, val, label]) => (
          <div key={label} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, color: 'var(--accent)' }}>{val}</div>
            <div style={{ color: 'var(--text3)', fontSize: 11, fontFamily: 'DM Mono', letterSpacing: '0.06em' }}>
              {label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {!editing ? (
        // View mode
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 22, marginBottom: 16
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <Avatar profile={profile} size={68} />
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800 }}>{profile.name}</div>
                <div style={{ color: 'var(--text2)', fontSize: 13, fontFamily: 'DM Mono', marginTop: 2 }}>
                  {profile.role}
                </div>
                <div style={{ color: 'var(--accent)', fontSize: 13, fontFamily: 'DM Mono' }}>
                  @ {profile.company}
                </div>
              </div>
            </div>

            {profile.bio && (
              <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.65,
                fontFamily: 'Lora', fontStyle: 'italic', marginBottom: 16 }}>
                "{profile.bio}"
              </p>
            )}

            <div style={{ marginBottom: 14 }}>
              <span style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 20,
                background: 'rgba(232,197,71,0.12)', color: 'var(--accent)',
                border: '1px solid rgba(232,197,71,0.25)', fontFamily: 'DM Mono'
              }}>
                {INTENT_LABELS[profile.intent] || '🌐 Networking'}
              </span>
            </div>

            {profile.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {profile.tags.map(t => (
                  <span key={t} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 20,
                    background: `${profile.avatar_color || '#e8c547'}18`,
                    color: profile.avatar_color || '#e8c547',
                    border: `1px solid ${profile.avatar_color || '#e8c547'}40`,
                    fontFamily: 'DM Mono'
                  }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSignOut}
            style={{
              width: '100%', padding: '13px',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(240,96,96,0.3)',
              background: 'rgba(240,96,96,0.06)',
              color: 'var(--red)', fontFamily: 'Syne',
              fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 8
            }}>
            Sign Out
          </button>
        </div>
      ) : (
        // Edit mode
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {[
              ['Name', 'name', 'text'],
              ['Role', 'role', 'text'],
              ['Company', 'company', 'text'],
              ['LinkedIn URL', 'linkedin_url', 'url'],
            ].map(([label, field, type]) => (
              <div key={field}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono',
                  letterSpacing: '0.06em', marginBottom: 6 }}>{label.toUpperCase()}</div>
                <input
                  type={type}
                  value={form[field] || ''}
                  onChange={e => update(field, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono',
                letterSpacing: '0.06em', marginBottom: 6 }}>BIO</div>
              <textarea
                value={form.bio || ''}
                onChange={e => update('bio', e.target.value)}
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              />
            </div>
          </div>

          {saved && (
            <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12,
              padding: '8px 12px', background: 'rgba(78,203,141,0.1)', borderRadius: 8 }}>
              ✓ Profile saved!
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditing(false)}
              style={{
                flex: 0, padding: '13px 20px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text2)', fontFamily: 'Syne', fontWeight: 700, cursor: 'pointer'
              }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              style={{
                flex: 1, padding: '13px', borderRadius: 'var(--radius)',
                background: 'var(--accent)', color: '#000',
                fontFamily: 'Syne', fontWeight: 800, fontSize: 15,
                border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1
              }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Dummy TapPage (redirect to home)
import { useEffect } from 'react'
export function TapPage() {
  const navigate = useNavigate()
  useEffect(() => navigate('/'), [])
  return null
}

const inputStyle = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '12px 14px',
  color: 'var(--text)', fontSize: 14, width: '100%', outline: 'none',
  fontFamily: 'DM Mono'
}

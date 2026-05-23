// src/pages/MatchPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import { saveConnection, getConnections } from '../lib/supabase'
import { generateFollowUp } from '../lib/ai'
import { Avatar } from './HomePage'

const INTENT_LABELS = {
  networking: '🌐 Networking',
  hiring: '🔍 Hiring',
  fundraising: '💰 Fundraising',
  cofounder: '🤝 Co-founder Hunt',
  partnerships: '🔗 Partnerships',
}

// Sparkle animation particles
const Sparkles = () => {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: 5 + Math.random() * 90,
    y: 5 + Math.random() * 60,
    size: 4 + Math.random() * 7,
    delay: Math.random() * 0.8,
    color: ['#e8c547','#f0a050','#4ecb8d','#60a0f0'][i % 4]
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: p.id % 2 === 0 ? '50%' : '2px',
          animation: `sparkle 1.4s ease-out ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  )
}

export default function MatchPage() {
  const navigate = useNavigate()
  const {
    user, profile, matchedProfile, aiInsight,
    currentRoom, setConnections, connectionSaved, setConnectionSaved,
    resetTapSession
  } = useStore()

  const [saving, setSaving] = useState(false)
  const [followUp, setFollowUp] = useState('')
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)

  // Redirect if no match (e.g. direct URL access)
  useEffect(() => {
    if (!matchedProfile) { navigate('/'); return }
    // Dramatic reveal delay
    setTimeout(() => setRevealed(true), 300)
  }, [matchedProfile])

  const handleSave = async () => {
    if (saving || connectionSaved) return
    setSaving(true)
    const { error } = await saveConnection({
      userA: user.id,
      userB: matchedProfile.id,
      roomId: currentRoom?.id,
      aiInsight
    })
    if (!error) {
      setConnectionSaved(true)
      // Refresh connections
      const { data } = await getConnections(user.id)
      if (data) setConnections(data)
    }
    setSaving(false)
  }

  const handleFollowUp = async () => {
    setShowFollowUp(true)
    if (!followUp) {
      const msg = await generateFollowUp(profile, matchedProfile, aiInsight)
      setFollowUp(msg)
    }
  }

  const copyFollowUp = () => {
    navigator.clipboard?.writeText(followUp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDone = () => {
    resetTapSession()
    navigate('/')
  }

  if (!matchedProfile) return null

  const color = matchedProfile.avatar_color || '#e8c547'
  const sharedTags = (profile?.tags || []).filter(t => (matchedProfile.tags || []).includes(t))

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      padding: '24px 20px 40px',
      position: 'relative', overflow: 'hidden'
    }}>
      <Sparkles />

      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto' }}>

        {/* Match header */}
        <div style={{ textAlign: 'center', marginBottom: 28, animation: 'fadeUp 0.4s ease' }}>
          <div style={{
            fontSize: 12, fontFamily: 'DM Mono', letterSpacing: '0.12em',
            color: 'var(--green)', marginBottom: 8
          }}>✦ TAP CONNECTED ✦</div>
          <h1 style={{
            fontFamily: 'Syne', fontSize: 30, fontWeight: 800,
            letterSpacing: '-0.04em', color: 'var(--text)', marginBottom: 6
          }}>You just met someone.</h1>
        </div>

        {/* The two avatars meeting */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 0, marginBottom: 28,
          animation: 'fadeUp 0.4s 0.1s ease both'
        }}>
          <Avatar profile={profile} size={64} />
          <div style={{
            width: 40, height: 2,
            background: `linear-gradient(90deg, ${profile?.avatar_color || '#e8c547'}, ${color})`,
            borderRadius: 2
          }} />
          <Avatar profile={matchedProfile} size={64} />
        </div>

        {/* Matched profile card */}
        <div style={{
          background: `linear-gradient(135deg, ${color}10, var(--bg3))`,
          border: `1px solid ${color}44`,
          borderRadius: 'var(--radius-lg)', padding: 24,
          marginBottom: 16,
          animation: revealed ? 'fadeUp 0.5s 0.15s ease both' : 'none',
          opacity: revealed ? 1 : 0,
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <Avatar profile={matchedProfile} size={62} />
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>
                {matchedProfile.name}
              </div>
              <div style={{ color: 'var(--text2)', fontSize: 13, fontFamily: 'DM Mono', marginTop: 2 }}>
                {matchedProfile.role}
              </div>
              <div style={{ color, fontSize: 13, fontFamily: 'DM Mono' }}>
                @ {matchedProfile.company}
              </div>
            </div>
          </div>

          {matchedProfile.bio && (
            <p style={{
              color: 'var(--text2)', fontSize: 14, lineHeight: 1.65,
              fontFamily: 'Lora', fontStyle: 'italic', marginBottom: 16,
              borderLeft: `3px solid ${color}60`, paddingLeft: 14
            }}>
              "{matchedProfile.bio}"
            </p>
          )}

          {/* Intent badge */}
          <div style={{ marginBottom: 14 }}>
            <span style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 20,
              background: `${color}18`, color, border: `1px solid ${color}44`,
              fontFamily: 'DM Mono'
            }}>
              {INTENT_LABELS[matchedProfile.intent] || '🌐 Networking'}
            </span>
          </div>

          {/* Tags */}
          {matchedProfile.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {matchedProfile.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20,
                  background: sharedTags.includes(tag) ? `${color}20` : 'var(--bg2)',
                  color: sharedTags.includes(tag) ? color : 'var(--text3)',
                  border: `1px solid ${sharedTags.includes(tag) ? `${color}50` : 'var(--border)'}`,
                  fontFamily: 'DM Mono',
                  fontWeight: sharedTags.includes(tag) ? 500 : 400,
                }}>{tag}{sharedTags.includes(tag) ? ' ✦' : ''}</span>
              ))}
            </div>
          )}

          {/* LinkedIn */}
          {matchedProfile.linkedin_url && (
            <a href={matchedProfile.linkedin_url.startsWith('http') ? matchedProfile.linkedin_url : `https://linkedin.com/in/${matchedProfile.linkedin_url}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: '#0a66c2', fontFamily: 'DM Mono',
                background: 'rgba(10,102,194,0.1)', border: '1px solid rgba(10,102,194,0.3)',
                borderRadius: 20, padding: '4px 12px'
              }}>
              LinkedIn →
            </a>
          )}
        </div>

        {/* AI Insight */}
        {aiInsight && (
          <div style={{
            background: 'rgba(232,197,71,0.07)',
            border: '1px solid rgba(232,197,71,0.2)',
            borderRadius: 'var(--radius-lg)', padding: 18,
            marginBottom: 16,
            animation: 'fadeUp 0.5s 0.25s ease both'
          }}>
            <div style={{ fontSize: 10, fontFamily: 'DM Mono', letterSpacing: '0.1em',
              color: 'var(--accent)', marginBottom: 8 }}>✦ WHY YOU'LL CLICK</div>
            <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.65, fontFamily: 'Lora' }}>
              {aiInsight}
            </p>
          </div>
        )}

        {/* Follow-up message */}
        {showFollowUp && (
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 18, marginBottom: 16,
            animation: 'fadeUp 0.35s ease'
          }}>
            <div style={{ fontSize: 10, fontFamily: 'DM Mono', letterSpacing: '0.1em',
              color: 'var(--text3)', marginBottom: 10 }}>AI FOLLOW-UP DRAFT</div>
            {followUp ? (
              <>
                <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.65,
                  fontFamily: 'Lora', marginBottom: 12 }}>
                  {followUp}
                </p>
                <button onClick={copyFollowUp} style={{
                  fontSize: 12, fontFamily: 'DM Mono', padding: '6px 14px',
                  borderRadius: 20, border: '1px solid var(--border2)',
                  background: 'transparent', color: copied ? 'var(--green)' : 'var(--text2)',
                  cursor: 'pointer'
                }}>
                  {copied ? '✓ Copied!' : 'Copy message'}
                </button>
              </>
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Generating…</div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'fadeUp 0.5s 0.3s ease both' }}>

          {!connectionSaved ? (
            <button onClick={handleSave} disabled={saving}
              style={{
                background: 'var(--accent)', color: '#000',
                fontFamily: 'Syne', fontWeight: 800, fontSize: 16,
                padding: '16px', borderRadius: 'var(--radius)',
                border: 'none', cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}>
              {saving ? 'Saving…' : '🤝 Save Connection'}
            </button>
          ) : (
            <div style={{
              textAlign: 'center', padding: '14px',
              borderRadius: 'var(--radius)',
              background: 'rgba(78,203,141,0.12)',
              border: '1px solid rgba(78,203,141,0.3)',
              color: 'var(--green)', fontFamily: 'Syne', fontWeight: 700
            }}>
              ✓ Saved to your network
            </div>
          )}

          {!showFollowUp && (
            <button onClick={handleFollowUp}
              style={{
                background: 'var(--bg3)', color: 'var(--text2)',
                fontFamily: 'Syne', fontWeight: 700, fontSize: 15,
                padding: '14px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}>
              ✍️ Generate Follow-up Message
            </button>
          )}

          <button onClick={handleDone}
            style={{
              background: 'transparent', color: 'var(--text3)',
              fontFamily: 'Syne', fontWeight: 600, fontSize: 14,
              padding: '12px', borderRadius: 'var(--radius)',
              border: 'none', cursor: 'pointer',
            }}>
            ← Tap someone else
          </button>
        </div>
      </div>
    </div>
  )
}

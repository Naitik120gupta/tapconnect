// src/pages/JoinPage.jsx
// Handles NFC deep links — /join/:code
// When someone's phone gets the NFC signal, it opens this URL
// and auto-joins the room immediately

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import { joinRoom, getProfile } from '../lib/supabase'
import { generateInsight } from '../lib/ai'

export default function JoinPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user, profile, setCurrentRoom, setMatchedProfile, setAiInsight } = useStore()
  const [status, setStatus] = useState('Connecting via NFC…')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      // Not logged in — send to auth with redirect back
      navigate(`/auth?redirect=/join/${code}`)
      return
    }
    if (!profile) return
    autoJoin()
  }, [user, profile])

  const autoJoin = async () => {
    setStatus('Joining room…')
    const { data: roomData, error: err } = await joinRoom(code, user.id)

    if (err) {
      setError(err.message || 'Room not found or expired')
      return
    }

    setStatus('Loading profile…')
    const { data: creatorProfile } = await getProfile(roomData.creator_id)

    setStatus('Generating AI insight…')
    const insight = await generateInsight(profile, creatorProfile)

    setMatchedProfile(creatorProfile)
    setAiInsight(insight)
    setCurrentRoom(roomData)
    navigate('/match')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24, textAlign: 'center'
    }}>
      <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800,
        letterSpacing: '-0.03em', marginBottom: 32 }}>
        tap<span style={{ color: 'var(--accent)' }}>.</span>connect
      </div>

      {!error ? (
        <>
          {/* NFC ripple animation */}
          <div style={{ position: 'relative', width: 100, height: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                position: 'absolute', borderRadius: '50%',
                border: '2px solid rgba(78,203,141,0.4)',
                width: 40 + i*24, height: 40 + i*24,
                animation: `pulse-ring 1.8s ease-out ${i*0.4}s infinite`
              }} />
            ))}
            <div style={{ fontSize: 32 }}>📡</div>
          </div>

          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {status}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono' }}>
            Code: {code}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Couldn't connect
          </div>
          <div style={{ color: 'var(--red)', fontSize: 13, fontFamily: 'DM Mono',
            marginBottom: 24 }}>
            {error}
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'var(--accent)', color: '#000',
              fontFamily: 'Syne', fontWeight: 800, fontSize: 15,
              padding: '13px 28px', borderRadius: 50, border: 'none', cursor: 'pointer'
            }}>
            Go Home
          </button>
        </>
      )}
    </div>
  )
}

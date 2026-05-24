// src/components/TapScreen.jsx
import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { getTapCapability, NFCSender, NFCReceiver, QRScanner } from '../lib/tap'
import { createRoom, joinRoom, getProfile, subscribeToRoom } from '../lib/supabase'
import { generateInsight } from '../lib/ai'
import { useStore } from '../stores/useStore'
import { useNavigate } from 'react-router-dom'

const CapBadge = ({ cap }) => {
  const labels = {
    nfc:  { icon: '📡', text: 'NFC Ready',  color: '#4ecb8d' },
    qr:   { icon: '📷', text: 'QR Ready',   color: '#60a0f0' },
    code: { icon: '🔢', text: 'Code Mode',  color: '#e8c547' },
  }
  const b = labels[cap] || labels.code
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontFamily: 'DM Mono', padding: '4px 12px',
      borderRadius: 20, border: `1px solid ${b.color}44`,
      background: `${b.color}12`, color: b.color
    }}>
      {b.icon} {b.text}
    </div>
  )
}

const Spinner = ({ color = 'var(--accent)', size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    border: `3px solid var(--border2)`,
    borderTopColor: color,
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto'
  }} />
)

export default function TapScreen() {
  const navigate = useNavigate()
  const { user, profile, setCurrentRoom, setMatchedProfile, setAiInsight } = useStore()

  const [cap] = useState(() => getTapCapability())
  const [phase, setPhase] = useState('idle')
  const [room, setRoom] = useState(null)
  const [code, setCode] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const nfcSenderRef   = useRef(null)
  const nfcReceiverRef = useRef(null)
  const videoRef       = useRef(null)
  const canvasRef      = useRef(null)
  const qrScannerRef   = useRef(null)
  const channelRef     = useRef(null)

  useEffect(() => {
    return () => cleanup()
  }, [])

  const cleanup = () => {
    nfcSenderRef.current?.cancel()
    nfcReceiverRef.current?.cancel()
    qrScannerRef.current?.stop()
    channelRef.current?.unsubscribe()
  }

  // ── Create room + subscribe to realtime ──────────────────────
  const createAndSubscribe = async () => {
    const { data, error: err } = await createRoom(user.id)
    if (err || !data) {
      setError('Failed to create room: ' + (err?.message || 'Unknown error'))
      setPhase('error')
      return null
    }
    setRoom(data)
    setCurrentRoom(data)
    setCode(data.code)

    channelRef.current = subscribeToRoom(data.id, async (payload) => {
      const updated = payload.new
      if (updated.status === 'matched' && updated.joiner_id) {
        channelRef.current?.unsubscribe()
        await finishMatch(updated, updated.joiner_id)
      }
    })

    return data
  }

  // ── Match finisher ───────────────────────────────────────────
  const finishMatch = async (roomData, otherUserId) => {
    setPhase('matching')
    const { data: otherProfile } = await getProfile(otherUserId)
    if (!otherProfile) {
      setError('Could not load their profile. Try again.')
      setPhase('error')
      return
    }
    const insight = await generateInsight(profile, otherProfile)
    setMatchedProfile(otherProfile)
    setAiInsight(insight)
    setCurrentRoom(roomData)
    navigate('/match')
  }

  // ── Join by code ─────────────────────────────────────────────
  const joinByCode = async (tapCode) => {
    setPhase('matching')
    setError('')
    const { data: roomData, error: err } = await joinRoom(tapCode, user.id)
    if (err || !roomData) {
      setError(err?.message || 'Code not found or expired.')
      setPhase('code-enter')
      return
    }
    await finishMatch(roomData, roomData.creator_id)
  }

  // ── Reset ────────────────────────────────────────────────────
  const reset = () => {
    cleanup()
    setPhase('idle')
    setRoom(null)
    setCode('')
    setEnteredCode('')
    setError('')
    setStatus('')
  }

  // ── NFC Send ─────────────────────────────────────────────────
  const startNFCSend = async () => {
    setPhase('nfc-send')
    setStatus('Creating room…')
    const roomData = await createAndSubscribe()
    if (!roomData) return
    setStatus('Hold phones back-to-back now…')
    try {
      nfcSenderRef.current = new NFCSender()
      await nfcSenderRef.current.writeCode(roomData.code)
      setStatus('Sent! Waiting for them to receive…')
    } catch (e) {
      setPhase('qr-show') // graceful fallback to QR
    }
  }

  // ── NFC Receive ──────────────────────────────────────────────
  const startNFCReceive = async () => {
    setPhase('nfc-receive')
    setStatus('Bring your phones together…')
    try {
      nfcReceiverRef.current = new NFCReceiver()
      await nfcReceiverRef.current.startScan((tapCode) => {
        joinByCode(tapCode)
      })
    } catch (e) {
      setError(e.message)
      setPhase('code-enter')
    }
  }

  // ── QR Show ──────────────────────────────────────────────────
  const startQRShow = async () => {
    setPhase('qr-show')
    if (!room) await createAndSubscribe()
  }

  // ── QR Scan ──────────────────────────────────────────────────
  const startQRScan = () => {
    setPhase('qr-scan')
    setError('')
    // Wait for DOM to render video element
    setTimeout(async () => {
      if (!videoRef.current || !canvasRef.current) return
      try {
        qrScannerRef.current = new QRScanner(videoRef.current, canvasRef.current)
        await qrScannerRef.current.start((tapCode) => {
          joinByCode(tapCode)
        })
      } catch (e) {
        setError(e.message)
        setPhase('code-enter')
      }
    }, 200)
  }

  // ── Code Show ────────────────────────────────────────────────
  const startCodeShow = async () => {
    setPhase('code-show')
    await createAndSubscribe()
  }

  const tapUrl = code ? `${window.location.origin}/join/${code}` : ''

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── IDLE ─────────────────────────────────── */}
      {phase === 'idle' && (
        <div style={{ animation: 'fadeUp 0.35s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <CapBadge cap={cap.recommended} />
            {!cap.isSecure && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)',
                fontFamily: 'DM Mono', background: 'rgba(240,96,96,0.1)',
                padding: '8px 12px', borderRadius: 8 }}>
                ⚠️ NFC requires HTTPS. Deploy to Vercel first.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <button onClick={() => setPhase('method-select')} style={btnGold}>
              <span style={{ fontSize: 22 }}>⚡</span> Start Tapping
            </button>
          </div>

          {/* How it works */}
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '16px 18px'
          }}>
            <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text3)',
              letterSpacing: '0.08em', marginBottom: 12 }}>HOW TO TAP</div>
            {[
              cap.nfc ? ['📡', 'NFC (Android Chrome + HTTPS)', 'Hold phones back-to-back'] : null,
              ['📷', 'QR Code', 'One shows QR, other scans it'],
              ['🔢', '6-Digit Code', 'Read it out loud — always works'],
            ].filter(Boolean).map(([icon, name, desc]) => (
              <div key={name} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, width: 28, flexShrink: 0 }}>{icon}</span>
                <div>
                  <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13 }}>{name}</span>
                  <div style={{ color: 'var(--text3)', fontSize: 11, fontFamily: 'DM Mono' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── METHOD SELECT ────────────────────────── */}
      {phase === 'method-select' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
            Who's going first?
          </div>
          <p style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono',
            marginBottom: 20, lineHeight: 1.6 }}>
            One person creates a code — the other joins.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {/* Sharing side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text3)',
                letterSpacing: '0.08em', marginBottom: 2 }}>I'M SHARING</div>
              {cap.nfc && <MethodBtn icon="📡" label="NFC Tap" sub="Android + Chrome only"
                color="#4ecb8d" onClick={startNFCSend} />}
              <MethodBtn icon="📱" label="Show QR" sub="They scan my screen"
                color="#60a0f0" onClick={startQRShow} />
              <MethodBtn icon="🔢" label="Show Code" sub="I read it aloud"
                color="#e8c547" onClick={startCodeShow} />
            </div>

            {/* Joining side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text3)',
                letterSpacing: '0.08em', marginBottom: 2 }}>I'M JOINING</div>
              {cap.nfc && <MethodBtn icon="📡" label="NFC Receive" sub="Android + Chrome only"
                color="#4ecb8d" onClick={startNFCReceive} />}
              {cap.qr && <MethodBtn icon="📷" label="Scan QR" sub="Point at their screen"
                color="#60a0f0" onClick={startQRScan} />}
              <MethodBtn icon="⌨️" label="Enter Code" sub="Type their 6 digits"
                color="#e8c547" onClick={() => setPhase('code-enter')} />
            </div>
          </div>
          <button onClick={reset} style={btnGhost}>← Back</button>
        </div>
      )}

      {/* ── NFC SEND ─────────────────────────────── */}
      {phase === 'nfc-send' && (
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease', padding: '20px 0' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📡</div>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Hold phones together
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'DM Mono',
            marginBottom: 8, lineHeight: 1.6 }}>{status}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono',
            marginBottom: 24 }}>NFC antenna = top-back of most Android phones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={startQRShow} style={btnGhost}>📱 Switch to QR instead</button>
            <button onClick={reset} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── NFC RECEIVE ──────────────────────────── */}
      {phase === 'nfc-receive' && (
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease', padding: '20px 0' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📡</div>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Bring phones together
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'DM Mono',
            marginBottom: 24 }}>{status}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={startQRScan} style={btnGhost}>📷 Scan QR instead</button>
            <button onClick={reset} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── QR SHOW ──────────────────────────────── */}
      {phase === 'qr-show' && (
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            They scan this
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono', marginBottom: 20 }}>
            Point their camera at the QR code
          </div>

          {code ? (
            <>
              <div style={{
                background: '#fff', borderRadius: 20, padding: 20,
                display: 'inline-block', marginBottom: 16,
                boxShadow: '0 0 60px rgba(255,255,255,0.08)'
              }}>
                <QRCodeSVG value={tapUrl} size={200} bgColor="#ffffff" fgColor="#080810" level="M" />
              </div>

              <div style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800,
                letterSpacing: '0.2em', color: 'var(--accent)', marginBottom: 6 }}>
                {code}
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 11, fontFamily: 'DM Mono',
                marginBottom: 16 }}>backup code · expires in 10 min</div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 20 }}>
                <Spinner size={16} color="var(--green)" />
                Waiting for scan…
              </div>
            </>
          ) : (
            <div style={{ padding: 40 }}><Spinner /></div>
          )}
          <button onClick={reset} style={btnGhost}>Cancel</button>
        </div>
      )}

      {/* ── QR SCAN ──────────────────────────────── */}
      {phase === 'qr-scan' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            Scan their QR code
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono', marginBottom: 14 }}>
            Point your camera at their screen
          </div>

          <div style={{
            position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            background: '#000', aspectRatio: '1', marginBottom: 14,
            border: '2px solid var(--border2)', maxHeight: 320
          }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              playsInline muted autoPlay />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Corner markers */}
            {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
              <div key={v+h} style={{
                position: 'absolute', [v]: 16, [h]: 16, width: 28, height: 28,
                borderTop: v === 'top' ? '3px solid var(--accent)' : 'none',
                borderBottom: v === 'bottom' ? '3px solid var(--accent)' : 'none',
                borderLeft: h === 'left' ? '3px solid var(--accent)' : 'none',
                borderRight: h === 'right' ? '3px solid var(--accent)' : 'none',
              }} />
            ))}
          </div>

          {error && <ErrorBox msg={error} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => { qrScannerRef.current?.stop(); setPhase('code-enter') }}
              style={btnGhost}>⌨️ Enter code manually instead</button>
            <button onClick={() => { qrScannerRef.current?.stop(); reset() }}
              style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── CODE SHOW ────────────────────────────── */}
      {phase === 'code-show' && (
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            Share this code
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono', marginBottom: 20 }}>
            Tell them to tap "Enter Code" and type this
          </div>

          <div style={{
            fontFamily: 'Syne', fontSize: 52, fontWeight: 800,
            letterSpacing: '0.22em', color: 'var(--accent)',
            background: 'var(--bg3)', border: '2px solid var(--border2)',
            borderRadius: 'var(--radius-lg)', padding: '28px 16px',
            marginBottom: 20, minHeight: 112,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {code || <Spinner />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 20 }}>
            <Spinner size={14} color="var(--green)" />
            Waiting for them to enter code…
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {cap.qr && (
              <button onClick={startQRShow} style={{ ...btnGhost, flex: 1, fontSize: 12 }}>
                📱 Switch to QR
              </button>
            )}
            <button onClick={reset} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── CODE ENTER ───────────────────────────── */}
      {phase === 'code-enter' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
            Enter the 6-digit code
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono', marginBottom: 16 }}>
            Ask the other person for their code
          </div>

          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={enteredCode}
            onChange={e => {
              setError('')
              setEnteredCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }}
            onKeyDown={e => e.key === 'Enter' && enteredCode.length === 6 && joinByCode(enteredCode)}
            autoFocus
            style={{
              background: 'var(--bg3)', border: '2px solid var(--border2)',
              borderRadius: 'var(--radius)', padding: '16px',
              color: 'var(--accent)', fontSize: 40, fontFamily: 'Syne', fontWeight: 800,
              textAlign: 'center', letterSpacing: '0.22em',
              width: '100%', outline: 'none', marginBottom: 12,
              transition: 'border-color 0.2s'
            }}
          />

          {error && <ErrorBox msg={error} />}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={reset} style={{ ...btnGhost, flex: 0, padding: '14px 20px' }}>←</button>
            <button
              onClick={() => joinByCode(enteredCode)}
              disabled={enteredCode.length !== 6}
              style={{
                ...btnGold, flex: 1,
                opacity: enteredCode.length === 6 ? 1 : 0.4,
                cursor: enteredCode.length === 6 ? 'pointer' : 'default'
              }}
            >
              Connect →
            </button>
          </div>
        </div>
      )}

      {/* ── MATCHING ─────────────────────────────── */}
      {phase === 'matching' && (
        <div style={{ textAlign: 'center', paddingTop: 48, animation: 'fadeIn 0.3s ease' }}>
          <Spinner size={52} />
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700,
            marginTop: 20, marginBottom: 8 }}>Connecting…</div>
          <div style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'DM Mono' }}>
            Loading profile & AI insight
          </div>
        </div>
      )}

      {/* ── ERROR ────────────────────────────────── */}
      {phase === 'error' && (
        <div style={{ textAlign: 'center', paddingTop: 48, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Something went wrong
          </div>
          {error && <ErrorBox msg={error} />}
          <button onClick={reset} style={{ ...btnGold, marginTop: 16 }}>Try again</button>
        </div>
      )}
    </div>
  )
}

// ── Reusable components ───────────────────────────────────────
const ErrorBox = ({ msg }) => (
  <div style={{
    color: 'var(--red)', fontSize: 13, marginBottom: 12,
    padding: '10px 14px', background: 'rgba(240,96,96,0.1)',
    borderRadius: 10, border: '1px solid rgba(240,96,96,0.2)',
    fontFamily: 'DM Mono', lineHeight: 1.5, textAlign: 'left'
  }}>{msg}</div>
)

const MethodBtn = ({ icon, label, sub, color, onClick }) => (
  <button onClick={onClick} style={{
    background: `${color}0e`, border: `1px solid ${color}33`,
    borderRadius: 'var(--radius)', padding: '12px 10px',
    textAlign: 'left', cursor: 'pointer', width: '100%',
  }}>
    <div style={{ fontSize: 18, marginBottom: 3 }}>{icon}</div>
    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{label}</div>
    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'DM Mono', lineHeight: 1.4 }}>{sub}</div>
  </button>
)

const btnGold = {
  background: 'var(--accent)', color: '#000',
  fontFamily: 'Syne', fontWeight: 800, fontSize: 16,
  padding: '15px', borderRadius: 'var(--radius)',
  border: 'none', cursor: 'pointer', width: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
}
const btnGhost = {
  background: 'var(--bg3)', color: 'var(--text2)',
  fontFamily: 'Syne', fontWeight: 600, fontSize: 14,
  padding: '13px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', cursor: 'pointer', width: '100%',
}
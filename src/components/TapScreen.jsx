// src/components/TapScreen.jsx
// ─────────────────────────────────────────────────────────────
// The main tap interaction - NFC / QR / Code in one unified UI
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { getTapCapability, NFCSender, NFCReceiver, QRScanner } from '../lib/tap'
import { createRoom, joinRoom, getProfile, subscribeToRoom } from '../lib/supabase'
import { generateInsight } from '../lib/ai'
import { useStore } from '../stores/useStore'
import { useNavigate } from 'react-router-dom'

// ── Capability badge ──────────────────────────────────────────
const CapBadge = ({ cap }) => {
  const labels = {
    nfc: { icon: '📡', text: 'NFC Ready', color: '#4ecb8d' },
    qr:  { icon: '📷', text: 'QR Ready',  color: '#60a0f0' },
    code:{ icon: '🔢', text: 'Code Mode', color: '#e8c547' },
  }
  const b = labels[cap] || labels.code
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontFamily: 'DM Mono', padding: '4px 12px',
      borderRadius: 20, border: `1px solid ${b.color}44`,
      background: `${b.color}12`, color: b.color
    }}>
      <span>{b.icon}</span> {b.text}
    </div>
  )
}

// ── NFC Tap Animation ─────────────────────────────────────────
const NFCAnimation = ({ active }) => (
  <div style={{ position: 'relative', width: 160, height: 160,
    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {active && [0,1,2].map(i => (
      <div key={i} style={{
        position: 'absolute', borderRadius: '50%',
        border: '2px solid rgba(78,203,141,0.5)',
        width: 80 + i * 30, height: 80 + i * 30,
        animation: `pulse-ring 2s ease-out ${i * 0.5}s infinite`,
      }} />
    ))}
    <div style={{
      width: 80, height: 80, borderRadius: '50%',
      background: active ? 'rgba(78,203,141,0.15)' : 'var(--bg3)',
      border: `2px solid ${active ? 'rgba(78,203,141,0.6)' : 'var(--border2)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 32, transition: 'all 0.3s ease',
      boxShadow: active ? '0 0 40px rgba(78,203,141,0.25)' : 'none',
    }}>📡</div>
  </div>
)

export default function TapScreen() {
  const navigate = useNavigate()
  const { user, profile, setCurrentRoom, setMatchedProfile, setAiInsight } = useStore()

  const [cap] = useState(() => getTapCapability())
  const [phase, setPhase] = useState('idle')
  // phases: idle | method-select | nfc-send | nfc-receive | 
  //         qr-show | qr-scan | code-show | code-enter | matching | error

  const [room, setRoom] = useState(null)
  const [code, setCode] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [error, setError] = useState('')
  const [nfcStatus, setNfcStatus] = useState('')

  const nfcSenderRef  = useRef(null)
  const nfcReceiverRef = useRef(null)
  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const qrScannerRef  = useRef(null)
  const channelRef    = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      nfcSenderRef.current?.cancel()
      nfcReceiverRef.current?.cancel()
      qrScannerRef.current?.stop()
      channelRef.current?.unsubscribe()
    }
  }, [])

  // ── Create a room and get a code ─────────────────────────────
  const createAndGetCode = async () => {
    const { data, error: err } = await createRoom(user.id)
    if (err) { setError(err.message); return null }
    setRoom(data)
    setCurrentRoom(data)
    setCode(data.code)

    // Subscribe to realtime updates
    channelRef.current = subscribeToRoom(data.id, async (payload) => {
      const updated = payload.new
      if (updated.status === 'matched' && updated.joiner_id) {
        channelRef.current?.unsubscribe()
        await doMatch(updated, updated.joiner_id)
      }
    })

    return data
  }

  // ── Handle matched - load profile + AI insight ────────────────
  const doMatch = async (roomData, otherUserId) => {
    setPhase('matching')
    const { data: otherProfile } = await getProfile(otherUserId)
    const insight = await generateInsight(profile, otherProfile)
    setMatchedProfile(otherProfile)
    setAiInsight(insight)
    setCurrentRoom(roomData)
    navigate('/match')
  }

  // ── Join a room by code ───────────────────────────────────────
  const joinByCode = async (tapCode) => {
    setPhase('matching')
    const { data: roomData, error: err } = await joinRoom(tapCode, user.id)
    if (err) {
      setError(err.message || 'Code not found or expired')
      setPhase('code-enter')
      return
    }
    await doMatch(roomData, roomData.creator_id)
  }

  // ── NFC SEND flow ─────────────────────────────────────────────
  const startNFCSend = async () => {
    setPhase('nfc-send')
    setNfcStatus('Creating room…')
    const roomData = await createAndGetCode()
    if (!roomData) { setPhase('error'); return }

    setNfcStatus('Hold phones back-to-back…')
    try {
      nfcSenderRef.current = new NFCSender()
      await nfcSenderRef.current.writeCode(roomData.code)
      setNfcStatus('Code sent! Waiting for connection…')
    } catch (e) {
      // NFC write failed, fall back to QR
      setNfcStatus('')
      setPhase('qr-show')
    }
  }

  // ── NFC RECEIVE flow ──────────────────────────────────────────
  const startNFCReceive = async () => {
    setPhase('nfc-receive')
    setNfcStatus('Bring phones together…')
    try {
      nfcReceiverRef.current = new NFCReceiver()
      await nfcReceiverRef.current.startScan((tapCode) => {
        setNfcStatus('Code received!')
        joinByCode(tapCode)
      })
    } catch (e) {
      setError('NFC scan failed — try QR instead')
      setPhase('qr-scan')
    }
  }

  // ── QR SHOW flow ──────────────────────────────────────────────
  const startQRShow = async () => {
    setPhase('qr-show')
    if (!room) await createAndGetCode()
  }

  // ── QR SCAN flow ──────────────────────────────────────────────
  const startQRScan = async () => {
    setPhase('qr-scan')
    // Give DOM time to render the video element
    setTimeout(async () => {
      try {
        qrScannerRef.current = new QRScanner(videoRef.current, canvasRef.current)
        await qrScannerRef.current.start((tapCode) => {
          joinByCode(tapCode)
        })
      } catch (e) {
        setError(e.message || 'Camera failed')
        setPhase('code-enter')
      }
    }, 100)
  }

  // ── CODE SHOW flow ────────────────────────────────────────────
  const startCodeShow = async () => {
    setPhase('code-show')
    if (!room) await createAndGetCode()
  }

  const reset = () => {
    nfcSenderRef.current?.cancel()
    nfcReceiverRef.current?.cancel()
    qrScannerRef.current?.stop()
    channelRef.current?.unsubscribe()
    setPhase('idle')
    setRoom(null)
    setCode('')
    setEnteredCode('')
    setError('')
    setNfcStatus('')
  }

  const tapUrl = code ? `${window.location.origin}/join/${code}` : ''

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 20px', minHeight: '60vh',
      display: 'flex', flexDirection: 'column' }}>

      {/* ── IDLE — choose role ────────────────────────── */}
      {phase === 'idle' && (
        <div style={{ animation: 'fadeUp 0.35s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <CapBadge cap={cap.recommended} />
            <p style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono',
              marginTop: 10, lineHeight: 1.6 }}>
              {cap.nfc
                ? 'NFC detected — hold phones together for instant tap'
                : cap.qr
                ? 'Point your camera at their QR code to connect'
                : 'Share a 6-digit code to connect'}
            </p>
          </div>

          {/* Big tap button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>

            {/* Primary action */}
            <button
              onClick={() => {
                if (cap.nfc) setPhase('method-select')
                else if (cap.qr) setPhase('method-select')
                else startCodeShow()
              }}
              style={btnGold}
            >
              <span style={{ fontSize: 24 }}>⚡</span>
              <span>Start Tapping</span>
            </button>

            {/* Show method selector */}
            <button onClick={() => setPhase('method-select')} style={btnGhost}>
              Choose method manually
            </button>
          </div>

          {/* How it works mini */}
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '16px 18px',
          }}>
            <div style={{ fontSize: 10, fontFamily: 'DM Mono', letterSpacing: '0.08em',
              color: 'var(--text3)', marginBottom: 12 }}>HOW IT WORKS</div>
            {[
              cap.nfc ? ['📡', 'NFC', 'Hold phones back-to-back'] : null,
              cap.qr  ? ['📷', 'QR Code', 'Scan their screen'] : null,
              ['🔢', '6-Digit Code', 'Share verbally — works everywhere'],
            ].filter(Boolean).map(([icon, name, desc]) => (
              <div key={name} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</span>
                <div>
                  <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{name}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono' }}> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── METHOD SELECT ────────────────────────────── */}
      {phase === 'method-select' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800,
            marginBottom: 6 }}>Who's going first?</div>
          <p style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'DM Mono',
            marginBottom: 24, lineHeight: 1.6 }}>
            One person creates — the other scans or enters the code.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {/* CREATE side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text3)',
                letterSpacing: '0.08em', marginBottom: 2 }}>I'M SHARING</div>
              {cap.nfc && (
                <MethodBtn icon="📡" label="NFC Tap" sub="Hold phones together"
                  color="#4ecb8d" onClick={startNFCSend} />
              )}
              <MethodBtn icon="📱" label="Show QR" sub="They scan my screen"
                color="#60a0f0" onClick={startQRShow} />
              <MethodBtn icon="🔢" label="Show Code" sub="I read it out"
                color="#e8c547" onClick={startCodeShow} />
            </div>

            {/* JOIN side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text3)',
                letterSpacing: '0.08em', marginBottom: 2 }}>I'M JOINING</div>
              {cap.nfc && (
                <MethodBtn icon="📡" label="NFC Receive" sub="Hold phones together"
                  color="#4ecb8d" onClick={startNFCReceive} />
              )}
              {cap.qr && (
                <MethodBtn icon="📷" label="Scan QR" sub="Point at their screen"
                  color="#60a0f0" onClick={startQRScan} />
              )}
              <MethodBtn icon="⌨️" label="Enter Code" sub="Type their code"
                color="#e8c547" onClick={() => setPhase('code-enter')} />
            </div>
          </div>

          <button onClick={reset} style={btnGhost}>← Back</button>
        </div>
      )}

      {/* ── NFC SEND ──────────────────────────────────── */}
      {phase === 'nfc-send' && (
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
          <NFCAnimation active={true} />
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, margin: '20px 0 8px' }}>
            Hold phones together
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'DM Mono',
            marginBottom: 24, lineHeight: 1.6 }}>
            {nfcStatus || 'Back-to-back, NFC antennas touching'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'DM Mono',
            marginBottom: 20 }}>
            NFC antenna is usually near the top-back of Android phones
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={startQRShow} style={btnGhost}>
              📱 Switch to QR instead
            </button>
            <button onClick={reset} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── NFC RECEIVE ───────────────────────────────── */}
      {phase === 'nfc-receive' && (
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
          <NFCAnimation active={true} />
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, margin: '20px 0 8px' }}>
            Bring your phones together
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'DM Mono',
            marginBottom: 24 }}>
            {nfcStatus || 'Scanning for NFC signal…'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={startQRScan} style={btnGhost}>
              📷 Scan QR instead
            </button>
            <button onClick={reset} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── QR SHOW ───────────────────────────────────── */}
      {phase === 'qr-show' && (
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            They scan this QR
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono',
            marginBottom: 20 }}>
            Point their camera at the code below
          </div>

          {code ? (
            <>
              <div style={{
                background: '#fff', borderRadius: 20, padding: 20,
                display: 'inline-block', marginBottom: 16,
                boxShadow: '0 0 40px rgba(255,255,255,0.1)'
              }}>
                <QRCodeSVG
                  value={tapUrl}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#080810"
                  level="M"
                />
              </div>
              <div style={{
                fontFamily: 'Syne', fontSize: 28, fontWeight: 800,
                letterSpacing: '0.18em', color: 'var(--accent)',
                marginBottom: 8
              }}>{code}</div>
              <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono',
                marginBottom: 20 }}>
                Code as backup · expires in 10 min
              </div>

              {/* Waiting indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid var(--border2)', borderTopColor: 'var(--green)',
                  animation: 'spin 1s linear infinite'
                }} />
                Waiting for them to scan…
              </div>
            </>
          ) : (
            <div style={{ padding: 40 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', margin: '0 auto 12px',
                border: '2px solid var(--border2)', borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          <button onClick={reset} style={btnGhost}>Cancel</button>
        </div>
      )}

      {/* ── QR SCAN ───────────────────────────────────── */}
      {phase === 'qr-scan' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Scan their QR code
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono',
            marginBottom: 16 }}>
            Point your camera at their screen
          </div>

          {/* Camera viewfinder */}
          <div style={{
            position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            background: '#000', aspectRatio: '1', marginBottom: 16,
            border: '2px solid var(--border2)'
          }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Corner markers */}
            {['top-left','top-right','bottom-left','bottom-right'].map(pos => {
              const [v,h] = pos.split('-')
              return (
                <div key={pos} style={{
                  position: 'absolute',
                  [v]: 16, [h]: 16,
                  width: 28, height: 28,
                  borderTop: v==='top' ? '3px solid var(--accent)' : 'none',
                  borderBottom: v==='bottom' ? '3px solid var(--accent)' : 'none',
                  borderLeft: h==='left' ? '3px solid var(--accent)' : 'none',
                  borderRight: h==='right' ? '3px solid var(--accent)' : 'none',
                }} />
              )
            })}
          </div>

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12,
              padding: '8px 12px', background: 'rgba(240,96,96,0.1)', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => { qrScannerRef.current?.stop(); setPhase('code-enter') }}
              style={btnGhost}>
              ⌨️ Enter code manually instead
            </button>
            <button onClick={() => { qrScannerRef.current?.stop(); reset() }}
              style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── CODE SHOW ─────────────────────────────────── */}
      {phase === 'code-show' && (
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Share this code
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono',
            marginBottom: 24 }}>
            Tell them to tap "Enter Code" and type this
          </div>

          <div style={{
            fontFamily: 'Syne', fontSize: 58, fontWeight: 800,
            letterSpacing: '0.2em', color: 'var(--accent)',
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius-lg)', padding: '28px 20px',
            marginBottom: 20,
          }}>
            {code || (
              <div style={{ width: 36, height: 36, borderRadius: '50%', margin: 'auto',
                border: '2px solid var(--border2)', borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite' }} />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%',
              border: '2px solid var(--border2)', borderTopColor: 'var(--green)',
              animation: 'spin 1s linear infinite' }} />
            Waiting for them to enter code…
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {cap.qr && (
              <button onClick={startQRShow} style={{ ...btnGhost, flex: 1, fontSize: 13 }}>
                📱 Switch to QR
              </button>
            )}
            <button onClick={reset} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── CODE ENTER ────────────────────────────────── */}
      {phase === 'code-enter' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
            Enter the 6-digit code
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'DM Mono',
            marginBottom: 20 }}>
            Ask the other person for their code
          </div>

          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={enteredCode}
            onChange={e => setEnteredCode(e.target.value.replace(/\D/g,'').slice(0,6))}
            onKeyDown={e => e.key === 'Enter' && enteredCode.length === 6 && joinByCode(enteredCode)}
            autoFocus
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '16px',
              color: 'var(--accent)', fontSize: 36, fontFamily: 'Syne', fontWeight: 800,
              textAlign: 'center', letterSpacing: '0.2em',
              width: '100%', outline: 'none', marginBottom: 12
            }}
          />

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12,
              padding: '8px 12px', background: 'rgba(240,96,96,0.1)', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={reset} style={{ ...btnGhost, flex: 0, padding: '14px 20px' }}>←</button>
            <button
              onClick={() => joinByCode(enteredCode)}
              disabled={enteredCode.length !== 6}
              style={{ ...btnGold, flex: 1, opacity: enteredCode.length === 6 ? 1 : 0.4 }}
            >
              Connect →
            </button>
          </div>
        </div>
      )}

      {/* ── MATCHING ──────────────────────────────────── */}
      {phase === 'matching' && (
        <div style={{ textAlign: 'center', paddingTop: 40, animation: 'fadeIn 0.3s ease' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
            border: '3px solid var(--border2)', borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite'
          }} />
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Connecting…
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'DM Mono' }}>
            Loading profile & generating AI insight
          </div>
        </div>
      )}

      {/* ── ERROR ─────────────────────────────────────── */}
      {phase === 'error' && (
        <div style={{ textAlign: 'center', paddingTop: 40, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ color: 'var(--red)', fontSize: 13, fontFamily: 'DM Mono', marginBottom: 24 }}>
            {error}
          </div>
          <button onClick={reset} style={btnGold}>Try again</button>
        </div>
      )}
    </div>
  )
}

// ── Small method button ───────────────────────────────────────
const MethodBtn = ({ icon, label, sub, color, onClick }) => (
  <button onClick={onClick} style={{
    background: `${color}0e`, border: `1px solid ${color}33`,
    borderRadius: 'var(--radius)', padding: '12px 10px',
    textAlign: 'left', cursor: 'pointer', width: '100%',
    transition: 'all var(--transition)',
  }}>
    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{label}</div>
    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono', lineHeight: 1.4 }}>{sub}</div>
  </button>
)

const btnGold = {
  background: 'var(--accent)', color: '#000',
  fontFamily: 'Syne', fontWeight: 800, fontSize: 16,
  padding: '16px', borderRadius: 'var(--radius)',
  border: 'none', cursor: 'pointer', width: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
}
const btnGhost = {
  background: 'var(--bg3)', color: 'var(--text2)',
  fontFamily: 'Syne', fontWeight: 600, fontSize: 14,
  padding: '13px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', cursor: 'pointer', width: '100%',
}

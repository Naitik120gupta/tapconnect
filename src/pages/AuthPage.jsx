// src/pages/AuthPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUp, signIn } from '../lib/supabase'

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) return setError('Fill in both fields')
    setLoading(true)
    setError('')

    const fn = mode === 'signup' ? signUp : signIn
    const { error: authError } = await fn(email, password)

    if (authError) {
      setError(authError.message)
    } else if (mode === 'signup') {
      setSuccess('Check your email to confirm your account!')
    } else {
      navigate('/') // onboarding check happens in AppShell
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 24px',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%',
        transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(232,197,71,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: 380, animation: 'fadeUp 0.5s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontFamily: 'Syne', fontSize: 36, fontWeight: 800,
            letterSpacing: '-0.04em', marginBottom: 8
          }}>
            tap<span style={{ color: 'var(--accent)' }}>.</span>connect
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, letterSpacing: '0.04em' }}>
            meet people. for real.
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg3)',
          borderRadius: 'var(--radius)',
          padding: 4,
          marginBottom: 28,
          border: '1px solid var(--border)'
        }}>
          {['signin', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '10px',
                borderRadius: 12,
                fontFamily: 'Syne', fontWeight: 700, fontSize: 14,
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#000' : 'var(--text2)',
                transition: 'all var(--transition)',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
          />

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: 'rgba(240,96,96,0.1)', borderRadius: 8 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ color: 'var(--green)', fontSize: 13, padding: '8px 12px', background: 'rgba(78,203,141,0.1)', borderRadius: 8 }}>
              {success}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...btnPrimaryStyle,
              opacity: loading ? 0.7 : 1,
              marginTop: 4
            }}
          >
            {loading
              ? 'Loading...'
              : mode === 'signin' ? 'Sign In →' : 'Create Account →'
            }
          </button>
        </div>

        <p style={{
          textAlign: 'center', color: 'var(--text3)',
          fontSize: 12, marginTop: 32, lineHeight: 1.6
        }}>
          By continuing, you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  )
}

const inputStyle = {
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '14px 16px',
  color: 'var(--text)',
  fontSize: 15,
  outline: 'none',
  width: '100%',
  transition: 'border-color var(--transition)',
}

const btnPrimaryStyle = {
  background: 'var(--accent)',
  color: '#000',
  fontFamily: 'Syne',
  fontWeight: 800,
  fontSize: 16,
  padding: '14px',
  borderRadius: 'var(--radius)',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  letterSpacing: '0.02em',
}

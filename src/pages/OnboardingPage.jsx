// src/pages/OnboardingPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { upsertProfile } from '../lib/supabase'
import { useStore } from '../stores/useStore'

const INTENT_OPTIONS = [
  { value: 'networking',   label: '🌐 Open Networking',      desc: 'Meeting interesting people' },
  { value: 'hiring',       label: '🔍 Hiring',               desc: 'Looking for talent' },
  { value: 'fundraising',  label: '💰 Fundraising',          desc: 'Raising a round' },
  { value: 'cofounder',    label: '🤝 Co-founder Hunt',      desc: 'Finding a co-founder' },
  { value: 'partnerships', label: '🔗 Partnerships',         desc: 'Exploring collabs' },
]

const POPULAR_TAGS = [
  'AI/ML', 'SaaS', 'Fintech', 'Web3', 'Design', 'Growth',
  'DevTools', 'B2B', 'Consumer', 'Healthcare', 'EdTech',
  'Deep Tech', 'Climate', 'Open Source', 'Venture', 'Angel'
]

const AVATAR_COLORS = [
  '#e8c547', '#f0a050', '#4ecb8d', '#60a0f0', '#e060c0',
  '#a090f0', '#50c8c0', '#f06060'
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, setProfile } = useStore()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    role: '',
    company: '',
    bio: '',
    tags: [],
    intent: '',
    linkedin_url: '',
    avatar_color: '#e8c547',
  })

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter(t => t !== tag)
        : f.tags.length < 6 ? [...f.tags, tag] : f.tags
    }))
  }

  const canNext = () => {
    if (step === 0) return form.name && form.role && form.company
    if (step === 1) return form.tags.length >= 1
    if (step === 2) return form.intent
    return true
  }

  const handleFinish = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await upsertProfile({
      id: user.id,
      ...form,
      updated_at: new Date().toISOString()
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setProfile(data)
    navigate('/')
  }

  const STEPS = [
    {
      title: 'Who are you?',
      subtitle: 'This is what people see when you tap',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input style={inputStyle} placeholder="Full name" value={form.name}
            onChange={e => update('name', e.target.value)} />
          <input style={inputStyle} placeholder="Job title / Role" value={form.role}
            onChange={e => update('role', e.target.value)} />
          <input style={inputStyle} placeholder="Company / Project" value={form.company}
            onChange={e => update('company', e.target.value)} />
          <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
            placeholder="Short bio — what are you building? (optional)"
            value={form.bio} onChange={e => update('bio', e.target.value)} />

          {/* Avatar color */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, letterSpacing: '0.06em' }}>
              PICK YOUR COLOR
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map(c => (
                <button key={c} onClick={() => update('avatar_color', c)}
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: c,
                    border: form.avatar_color === c ? `3px solid #fff` : '3px solid transparent',
                    transition: 'transform var(--transition)',
                    transform: form.avatar_color === c ? 'scale(1.15)' : 'scale(1)'
                  }} />
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Your interests',
      subtitle: 'Pick up to 6 tags — used for AI matching',
      content: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {POPULAR_TAGS.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)}
              style={{
                padding: '8px 16px',
                borderRadius: 50,
                fontSize: 13,
                fontFamily: 'DM Mono',
                border: `1px solid ${form.tags.includes(tag) ? 'var(--accent)' : 'var(--border2)'}`,
                background: form.tags.includes(tag) ? 'rgba(232,197,71,0.15)' : 'var(--bg3)',
                color: form.tags.includes(tag) ? 'var(--accent)' : 'var(--text2)',
                transition: 'all var(--transition)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )
    },
    {
      title: "Why are you here?",
      subtitle: 'Your intent is shown after a tap',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {INTENT_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => update('intent', opt.value)}
              style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius)',
                border: `1px solid ${form.intent === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                background: form.intent === opt.value ? 'rgba(232,197,71,0.1)' : 'var(--bg3)',
                color: 'var(--text)',
                textAlign: 'left',
                transition: 'all var(--transition)',
                display: 'flex', flexDirection: 'column', gap: 2
              }}
            >
              <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>{opt.label}</span>
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      )
    },
    {
      title: 'Last step',
      subtitle: 'Optional — makes your profile richer',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input style={inputStyle} placeholder="LinkedIn URL (optional)"
            value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} />

          {/* Preview card */}
          <div style={{
            marginTop: 12,
            background: 'var(--bg3)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: 20,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 14 }}>
              YOUR TAP CARD PREVIEW
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: `${form.avatar_color}22`,
                border: `2px solid ${form.avatar_color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Syne', fontWeight: 800, fontSize: 16,
                color: form.avatar_color, flexShrink: 0
              }}>
                {(form.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17 }}>
                  {form.name || 'Your Name'}
                </div>
                <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'DM Mono' }}>
                  {form.role || 'Your Role'} · {form.company || 'Company'}
                </div>
              </div>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.tags.map(t => (
                  <span key={t} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 20,
                    background: `${form.avatar_color}18`,
                    color: form.avatar_color,
                    border: `1px solid ${form.avatar_color}40`,
                    fontFamily: 'DM Mono'
                  }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }
  ]

  const currentStep = STEPS[step]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      padding: '28px 24px 40px', background: 'var(--bg)',
      maxWidth: 480, margin: '0 auto'
    }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? 'var(--accent)' : 'var(--bg3)',
            transition: 'background 0.4s ease'
          }} />
        ))}
      </div>

      <div style={{ flex: 1, animation: 'fadeUp 0.35s ease' }} key={step}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            {currentStep.title}
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>{currentStep.subtitle}</p>
        </div>

        {currentStep.content}

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 16,
            padding: '8px 12px', background: 'rgba(240,96,96,0.1)', borderRadius: 8 }}>
            {error}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{
              padding: '14px 20px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text2)',
              fontFamily: 'Syne', fontWeight: 700, fontSize: 15
            }}>←</button>
        )}
        <button
          disabled={!canNext() || loading}
          onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : handleFinish()}
          style={{
            flex: 1, padding: '14px',
            borderRadius: 'var(--radius)',
            background: canNext() ? 'var(--accent)' : 'var(--bg3)',
            color: canNext() ? '#000' : 'var(--text3)',
            fontFamily: 'Syne', fontWeight: 800, fontSize: 16,
            border: 'none', cursor: canNext() ? 'pointer' : 'default',
            transition: 'all var(--transition)'
          }}
        >
          {loading ? 'Saving...' : step < STEPS.length - 1 ? 'Continue →' : 'Finish Setup ✓'}
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '13px 16px',
  color: 'var(--text)',
  fontSize: 15, width: '100%',
  outline: 'none',
  fontFamily: 'DM Mono',
}

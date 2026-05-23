// src/components/InstallPrompt.jsx
// Shows a subtle "Add to Home Screen" banner
// Only appears after 30s, only once per session, never blocks the UI
// iOS shows manual instructions, Android uses native prompt

import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [show, setShow]           = useState(false)
  const [deferredPrompt, setDP]   = useState(null)
  const [isIOS, setIsIOS]         = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Don't show if already installed (running as standalone PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if dismissed this session
    if (sessionStorage.getItem('pwa-dismissed')) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    // Android/Chrome: catch the beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault()
      setDP(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Show banner after 30s — user has had time to explore
    const timer = setTimeout(() => {
      setShow(true)
    }, 30000)

    // Also show for iOS after 30s (no native prompt available)
    if (ios) {
      setTimeout(() => setShow(true), 30000)
    }

    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setShow(false)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
      setDP(null)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    sessionStorage.setItem('pwa-dismissed', '1')
  }

  if (!show || installed) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 82,          // sits just above the bottom nav
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 448,
      zIndex: 200,
      animation: 'fadeUp 0.4s ease',
    }}>
      <div style={{
        background: 'rgba(16,16,30,0.97)',
        border: '1px solid rgba(232,197,71,0.25)',
        borderRadius: 18,
        padding: '14px 16px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,197,71,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        {/* Icon */}
        <img
          src="/icons/icon-192.png"
          alt="tap.connect"
          style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
        />

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Syne', fontWeight: 700, fontSize: 14,
            color: 'var(--text)', marginBottom: 2,
          }}>
            Add to Home Screen
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text3)',
            fontFamily: 'DM Mono', lineHeight: 1.4,
          }}>
            {isIOS
              ? "Tap Share → \"Add to Home Screen\""
              : "Open instantly at your next event"
            }
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              style={{
                background: 'var(--accent)',
                color: '#000',
                fontFamily: 'Syne', fontWeight: 800,
                fontSize: 13, padding: '7px 14px',
                borderRadius: 20, border: 'none', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Install
            </button>
          )}
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              color: 'var(--text3)',
              fontFamily: 'DM Mono', fontSize: 18,
              padding: '4px 6px', border: 'none',
              cursor: 'pointer', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* iOS manual instruction */}
      {isIOS && (
        <div style={{
          marginTop: 8,
          background: 'rgba(16,16,30,0.97)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '12px 16px',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{
            fontSize: 12, color: 'var(--text2)',
            fontFamily: 'DM Mono', lineHeight: 1.7,
          }}>
            1. Tap <span style={{ color: 'var(--accent)' }}>⎙ Share</span> at the bottom of Safari<br />
            2. Scroll down → tap <span style={{ color: 'var(--accent)' }}>"Add to Home Screen"</span><br />
            3. Tap <span style={{ color: 'var(--accent)' }}>Add</span> — done ✓
          </div>
        </div>
      )}
    </div>
  )
}

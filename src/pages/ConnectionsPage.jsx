// src/pages/ConnectionsPage.jsx
import { useEffect, useState } from 'react'
import { useStore } from '../stores/useStore'
import { getConnections } from '../lib/supabase'
import { Avatar } from './HomePage'

const INTENT_LABELS = {
  networking: '🌐', hiring: '🔍', fundraising: '💰',
  cofounder: '🤝', partnerships: '🔗',
}

export default function ConnectionsPage() {
  const { user, connections, setConnections, connectionsLoading, setConnectionsLoading } = useStore()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    setConnectionsLoading(true)
    const { data } = await getConnections(user.id)
    if (data) setConnections(data)
    setConnectionsLoading(false)
  }

  // Get the "other person" from a connection
  const getOther = (conn) => {
    return conn.user_a === user.id ? conn.profile_b : conn.profile_a
  }

  const filtered = connections.filter(c => {
    const other = getOther(c)
    if (!other) return false
    const q = search.toLowerCase()
    return !q ||
      other.name?.toLowerCase().includes(q) ||
      other.company?.toLowerCase().includes(q) ||
      other.role?.toLowerCase().includes(q) ||
      other.tags?.some(t => t.toLowerCase().includes(q))
  })

  const formatDate = (d) => {
    const date = new Date(d)
    const now = new Date()
    const diff = now - date
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ padding: '24px 20px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800,
          letterSpacing: '-0.03em', marginBottom: 4 }}>
          Your Network
        </h1>
        <div style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'DM Mono' }}>
          {connections.length} connection{connections.length !== 1 ? 's' : ''} saved
        </div>
      </div>

      {/* Search */}
      {connections.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <input
            placeholder="Search by name, role, company, tag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px 16px',
              color: 'var(--text)', fontSize: 14, width: '100%', outline: 'none',
              fontFamily: 'DM Mono'
            }}
          />
        </div>
      )}

      {/* Loading */}
      {connectionsLoading && (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '2px solid var(--border2)', borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px'
          }} />
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        </div>
      )}

      {/* Empty state */}
      {!connectionsLoading && connections.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📲</div>
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            No connections yet
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 14, maxWidth: 260, margin: '0 auto' }}>
            Go tap someone at your next event to start building your network.
          </div>
        </div>
      )}

      {/* Connection list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(conn => {
          const other = getOther(conn)
          if (!other) return null
          const isExpanded = expanded === conn.id
          const color = other.avatar_color || '#e8c547'

          return (
            <div
              key={conn.id}
              onClick={() => setExpanded(isExpanded ? null : conn.id)}
              style={{
                background: isExpanded ? `${color}08` : 'var(--bg3)',
                border: `1px solid ${isExpanded ? `${color}40` : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: isExpanded ? '18px 18px 0' : '16px 18px',
                cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar profile={other} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16 }}>
                    {other.name}
                  </div>
                  <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'DM Mono', marginTop: 2 }}>
                    {other.role} · {other.company}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>
                    {INTENT_LABELS[other.intent] || '🌐'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono' }}>
                    {formatDate(conn.created_at)}
                  </div>
                </div>
              </div>

              {/* Expanded view */}
              {isExpanded && (
                <div style={{
                  marginTop: 16, paddingTop: 16,
                  borderTop: '1px solid var(--border)',
                  animation: 'fadeUp 0.25s ease',
                  paddingBottom: 18
                }}>
                  {other.bio && (
                    <p style={{
                      color: 'var(--text2)', fontSize: 14, lineHeight: 1.6,
                      fontFamily: 'Lora', fontStyle: 'italic', marginBottom: 14
                    }}>"{other.bio}"</p>
                  )}

                  {other.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {other.tags.map(t => (
                        <span key={t} style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 20,
                          background: `${color}15`, color,
                          border: `1px solid ${color}40`, fontFamily: 'DM Mono'
                        }}>{t}</span>
                      ))}
                    </div>
                  )}

                  {conn.ai_insight && (
                    <div style={{
                      background: 'rgba(232,197,71,0.07)',
                      border: '1px solid rgba(232,197,71,0.2)',
                      borderRadius: 12, padding: '12px 14px', marginBottom: 14
                    }}>
                      <div style={{ fontSize: 10, fontFamily: 'DM Mono', letterSpacing: '0.1em',
                        color: 'var(--accent)', marginBottom: 6 }}>✦ WHY YOU CLICKED</div>
                      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, fontFamily: 'Lora' }}>
                        {conn.ai_insight}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    {other.linkedin_url && (
                      <a
                        href={other.linkedin_url.startsWith('http') ? other.linkedin_url : `https://linkedin.com/in/${other.linkedin_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: 12, padding: '7px 14px', borderRadius: 20,
                          background: 'rgba(10,102,194,0.1)', color: '#0a66c2',
                          border: '1px solid rgba(10,102,194,0.3)', fontFamily: 'DM Mono'
                        }}
                      >
                        LinkedIn →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Export */}
      {connections.length > 0 && (
        <button
          onClick={() => exportCSV(connections, user.id)}
          style={{
            marginTop: 28, width: '100%', padding: '13px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text3)',
            fontFamily: 'DM Mono', fontSize: 13, cursor: 'pointer'
          }}>
          ↓ Export as CSV
        </button>
      )}
    </div>
  )
}

function exportCSV(connections, userId) {
  const rows = [['Name', 'Role', 'Company', 'Tags', 'LinkedIn', 'Connected At']]
  connections.forEach(c => {
    const other = c.user_a === userId ? c.profile_b : c.profile_a
    if (!other) return
    rows.push([
      other.name, other.role, other.company,
      (other.tags || []).join('; '),
      other.linkedin_url || '',
      new Date(c.created_at).toLocaleDateString()
    ])
  })
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'tap-connections.csv'; a.click()
  URL.revokeObjectURL(url)
}

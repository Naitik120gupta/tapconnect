// src/lib/supabase.js
// ─────────────────────────────────────────────
// Replace these with your actual Supabase values from:
// https://app.supabase.com → Your Project → Settings → API
// ─────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
})

// ─── AUTH HELPERS ───────────────────────────
export const signUp = (email, password) =>
  supabase.auth.signUp({ email, password })

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getUser = () => supabase.auth.getUser()

// ─── PROFILE HELPERS ────────────────────────
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export const upsertProfile = async (profile) => {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single()
  return { data, error }
}

// ─── TAP ROOM HELPERS ────────────────────────
export const createRoom = async (userId) => {
  // Generate a unique 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const { data, error } = await supabase
    .from('tap_rooms')
    .insert({
      code,
      creator_id: userId,
      status: 'waiting',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    })
    .select()
    .single()
  return { data, error }
}

export const joinRoom = async (code, joinerId) => {
  // Find the waiting room with this code
  const { data: room, error: findError } = await supabase
    .from('tap_rooms')
    .select('*')
    .eq('code', code)
    .eq('status', 'waiting')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (findError || !room) return { data: null, error: findError || new Error('Room not found or expired') }
  if (room.creator_id === joinerId) return { data: null, error: new Error("You can't join your own room") }

  // Update room with joiner
  const { data, error } = await supabase
    .from('tap_rooms')
    .update({ joiner_id: joinerId, status: 'matched' })
    .eq('id', room.id)
    .select()
    .single()

  return { data, error }
}

export const subscribeToRoom = (roomId, callback) => {
  return supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tap_rooms',
      filter: `id=eq.${roomId}`
    }, callback)
    .subscribe()
}

// ─── CONNECTION HELPERS ──────────────────────
export const saveConnection = async ({ userA, userB, roomId, aiInsight }) => {
  const { data, error } = await supabase
    .from('connections')
    .upsert({
      user_a: userA,
      user_b: userB,
      room_id: roomId,
      ai_insight: aiInsight
    }, { onConflict: 'user_a,user_b' })
    .select()
    .single()
  return { data, error }
}

export const getConnections = async (userId) => {
  const { data, error } = await supabase
    .from('connections')
    .select(`
      *,
      profile_a:profiles!connections_user_a_fkey(*),
      profile_b:profiles!connections_user_b_fkey(*)
    `)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const updateConnectionNote = async (connectionId, userId, note) => {
  // Determine if user is user_a or user_b
  const { data: conn } = await supabase
    .from('connections').select('user_a, user_b').eq('id', connectionId).single()
  const field = conn?.user_a === userId ? 'note_a' : 'note_b'
  return supabase.from('connections').update({ [field]: note }).eq('id', connectionId)
}

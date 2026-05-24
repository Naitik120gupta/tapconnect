// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
})

// ─── AUTH ────────────────────────────────────────────────────
export const signUp = (email, password) =>
  supabase.auth.signUp({ email, password })

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getUser = () => supabase.auth.getUser()

// ─── PROFILE ─────────────────────────────────────────────────
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()           // ← won't throw if not found
  return { data, error }
}

export const upsertProfile = async (profile) => {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .maybeSingle()
  return { data, error }
}

// ─── TAP ROOMS ───────────────────────────────────────────────
export const createRoom = async (userId) => {
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
    .maybeSingle()
  return { data, error }
}

export const joinRoom = async (code, joinerId) => {
  // Step 1: find the room — use maybeSingle to avoid JSON coerce error
  const { data: room, error: findError } = await supabase
    .from('tap_rooms')
    .select('*')
    .eq('code', code.trim())
    .eq('status', 'waiting')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()           // ← THIS is the fix for your error

  if (findError) return { data: null, error: findError }
  if (!room) return { data: null, error: new Error('Code not found or expired. Check the code and try again.') }
  if (room.creator_id === joinerId) return { data: null, error: new Error("You can't join your own room — use a different account.") }

  // Step 2: claim the room
  const { data, error } = await supabase
    .from('tap_rooms')
    .update({ joiner_id: joinerId, status: 'matched' })
    .eq('id', room.id)
    .select()
    .maybeSingle()

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

// ─── CONNECTIONS ─────────────────────────────────────────────
export const saveConnection = async ({ userA, userB, roomId, aiInsight }) => {
  // Always store with smaller UUID first to avoid duplicates
  const [a, b] = [userA, userB].sort()
  const { data, error } = await supabase
    .from('connections')
    .upsert({
      user_a: a,
      user_b: b,
      room_id: roomId,
      ai_insight: aiInsight
    }, { onConflict: 'user_a,user_b' })
    .select()
    .maybeSingle()
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
  return { data: data || [], error }
}

export const updateConnectionNote = async (connectionId, userId, note) => {
  const { data: conn } = await supabase
    .from('connections').select('user_a').eq('id', connectionId).maybeSingle()
  const field = conn?.user_a === userId ? 'note_a' : 'note_b'
  return supabase.from('connections').update({ [field]: note }).eq('id', connectionId)
}
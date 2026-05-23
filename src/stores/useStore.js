// src/stores/useStore.js
import { create } from 'zustand'
import { supabase, getProfile } from '../lib/supabase'

export const useStore = create((set, get) => ({
  // ─── Auth ───────────────────────────────────
  user: null,
  profile: null,
  authLoading: true,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setAuthLoading: (v) => set({ authLoading: v }),

  loadProfile: async (userId) => {
    const { data } = await getProfile(userId)
    if (data) set({ profile: data })
    return data
  },

  // ─── Current tap session ─────────────────────
  currentRoom: null,
  matchedProfile: null,
  aiInsight: null,
  connectionSaved: false,

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setMatchedProfile: (profile) => set({ matchedProfile: profile }),
  setAiInsight: (insight) => set({ aiInsight: insight }),
  setConnectionSaved: (v) => set({ connectionSaved: v }),

  resetTapSession: () => set({
    currentRoom: null,
    matchedProfile: null,
    aiInsight: null,
    connectionSaved: false
  }),

  // ─── Connections ─────────────────────────────
  connections: [],
  connectionsLoading: false,
  setConnections: (connections) => set({ connections }),
  setConnectionsLoading: (v) => set({ connectionsLoading: v }),
}))

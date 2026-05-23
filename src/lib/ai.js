// src/lib/ai.js
// Calls Claude API to generate "Why you'll click" insight
// Uses the Anthropic API via fetch

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || ''

export const generateInsight = async (profileA, profileB) => {
  if (!ANTHROPIC_API_KEY) {
    return fallbackInsight(profileA, profileB)
  }

  try {
    const prompt = `Two professionals just tapped phones at a networking event. Generate a single, warm, specific 1-2 sentence insight on why they should talk and what they have in common. Be conversational, not corporate. No bullet points.

Person A: ${profileA.name}, ${profileA.role} at ${profileA.company}. Interests: ${profileA.tags?.join(', ')}. Intent: ${profileA.intent}.

Person B: ${profileB.name}, ${profileB.role} at ${profileB.company}. Interests: ${profileB.tags?.join(', ')}. Intent: ${profileB.intent}.

Output only the insight, nothing else.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    return data.content?.[0]?.text || fallbackInsight(profileA, profileB)
  } catch (err) {
    console.error('AI insight error:', err)
    return fallbackInsight(profileA, profileB)
  }
}

// Fallback if no API key yet — still feels smart
const fallbackInsight = (a, b) => {
  const sharedTags = (a.tags || []).filter(t => (b.tags || []).includes(t))

  if (sharedTags.length > 0) {
    return `You're both into ${sharedTags.slice(0, 2).join(' and ')} — that's a rare overlap. Ask ${b.name.split(' ')[0]} what they're working on right now.`
  }

  const intentMatches = {
    hiring: 'looking for talent',
    fundraising: 'raising',
    cofounder: 'finding a co-founder',
    partnerships: 'exploring partnerships',
    networking: 'expanding their network'
  }

  const aIntent = intentMatches[a.intent] || 'networking'
  const bIntent = intentMatches[b.intent] || 'networking'

  if (a.intent === b.intent) {
    return `You're both ${aIntent} — you're likely facing the same challenges right now. This conversation could be valuable.`
  }

  return `${a.name.split(' ')[0]} is ${aIntent} and ${b.name.split(' ')[0]} is ${bIntent}. There's a real synergy here worth exploring.`
}

// Generate a follow-up message draft
export const generateFollowUp = async (myProfile, theirProfile, insight) => {
  if (!ANTHROPIC_API_KEY) {
    return `Hey ${theirProfile.name.split(' ')[0]}, great meeting you at the event! ${insight} Would love to continue the conversation — when are you free for a quick call?`
  }

  try {
    const prompt = `Write a short, warm follow-up message from ${myProfile.name} to ${theirProfile.name} after they met at a networking event. 

Context: ${insight}

Keep it under 3 sentences. Casual and genuine, not salesy. End with a clear ask.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    return data.content?.[0]?.text || ''
  } catch (err) {
    return `Hey ${theirProfile.name.split(' ')[0]}, great meeting you! Would love to stay in touch.`
  }
}

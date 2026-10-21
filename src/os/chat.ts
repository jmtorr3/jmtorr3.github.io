import { profile } from '../data/profile'
import type { Expression } from '../scene/SlumpyFace'

// The things Slumpy answers when you talk to him: typing at him in the room
// (his screen's a command line), or in the Konsole when what you typed isn't a
// command. The first of these words in what you said:
// [a word, his face, what he says out loud, or else what the Konsole shows him doing]
const WORDS: [RegExp, Expression, string, boolean?][] = [
  [/^(hi+|hello+|hey+|yo+|sup|hiya|howdy|hola)$/, 'happy', 'hi!'],
  [new RegExp(`^${profile.host}$`), 'love', "that's me!"],
  [new RegExp(`^(${profile.name.split(' ')[0].toLowerCase()}|${profile.creator})$`), 'excited', 'my creator!'],
  [/^(bye+|goodbye|cya|later)$/, 'sad', 'bye bye!'],
  [/^(love|ily|cute|good)$/, 'blush', 'aww'],
  [/^(dumb|stupid|bad|ugly)$/, 'cry', '*sniff*', true],
  [/^sudo$/, 'suspicious', '*squints at you*', true],
]

// in the room, these take you to the desktop (like clicking him)
export const SIGN_IN_COMMANDS = /^(login|startx|start|boot|desktop)$/

export type ChatReply = { expr: Expression; says?: string; does?: string }

// whole questions he has a very clear answer to
const QUESTIONS: [RegExp, ChatReply][] = [
  [/\b(are|r)\s+(you|u)\s+(alive|real|sentient|conscious)\b|^(you|u)\s+alive\b/i, { expr: 'yes', says: 'YES!!!' }],
]

export function chatReply(text: string): ChatReply | null {
  for (const [re, reply] of QUESTIONS) if (re.test(text)) return reply
  const words = text.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean)
  for (const w of words) {
    const hit = WORDS.find(([re]) => re.test(w))
    if (hit) return hit[3] ? { expr: hit[1], does: hit[2] } : { expr: hit[1], says: hit[2] }
  }
  return null
}

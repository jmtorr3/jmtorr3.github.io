import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'

// Typing in the room presses keys on Chiba, the 3D keyboard. Its keys are single
// light texels painted on its top face, in three rows (and a wide spacebar), so a
// press is a dark cap over the matching texel for a moment, like the key going
// down. The caps are children of the keyboard mesh, so they follow it around.

// the texels on the keyboard's top face: u runs left to right as you sit at it
// (u 40 at the far left, which is its +x end), v from the far edge (v 9, +z) to
// the near one (v 17)
const FACE = { u0: 40, u1: 58, v0: 9, v1: 17 }
// the painted keys in each row, as texel columns, left to right, and the keys of
// a QWERTY keyboard each spreads across them (the number row lands on the top row too)
const ROWS = [
  { v: 11, keys: [41, 43, 45, 47, 49, 51, 52, 54, 56], chars: ['1234567890', 'qwertyuiop'] },
  { v: 13, keys: [43, 45, 47, 49, 51, 52, 54, 56], chars: ['asdfghjkl'] },
  { v: 15, keys: [41, 42, 45, 53, 54, 55], chars: ['zxcvbnm'] },
]
const SPACE = { v: 15, u: 47, w: 4 }
const PRESS_SECONDS = 0.11
const ROCK = 0.012 // radians the whole keyboard rocks with each press

export type KeyCaps = {
  press: (key: string) => void
  update: (dt: number) => void
}

export function makeKeyCaps(keyboard: THREE.Mesh, onRock: () => boolean): KeyCaps {
  // (DeskProps moved its pivot to its middle, so measure the face as it is now)
  keyboard.geometry.computeBoundingBox()
  const box = keyboard.geometry.boundingBox!
  const tx = (box.max.x - box.min.x) / (FACE.u1 - FACE.u0)
  const tz = (box.max.z - box.min.z) / (FACE.v1 - FACE.v0)
  const material = makePicoMaterial(new THREE.DataTexture(new Uint8Array([0x6f, 0x6a, 0x60, 255]), 1, 1))
  // a few caps to go around, for fast typing
  const caps = Array.from({ length: 4 }, () => {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1, 0.004, tz * 0.9), material)
    cap.visible = false
    cap.raycast = () => {} // not something to click or grab: clicks go to the keyboard
    keyboard.add(cap)
    return { cap, left: 0 }
  })
  let next = 0

  const place = (u: number, v: number, w: number) => {
    const c = caps[next]
    next = (next + 1) % caps.length
    c.cap.scale.x = tx * (w - 0.1)
    c.cap.position.set(box.max.x - (u + w / 2 - FACE.u0) * tx, box.max.y + 0.0015, box.max.z - (v + 0.5 - FACE.v0) * tz)
    c.cap.visible = true
    c.left = PRESS_SECONDS
  }

  return {
    press: (key) => {
      const k = key.toLowerCase()
      if (k === ' ') place(SPACE.u, SPACE.v, SPACE.w)
      else if (key === 'Enter') place(56, 13, 1) // the end of the middle row
      else if (key === 'Backspace') place(56, 11, 1) // the end of the top row
      else {
        // where it is on a QWERTY keyboard, snapped to the nearest painted key in that row
        const row = ROWS.find((r) => r.chars.some((c) => c.includes(k))) ?? ROWS[0]
        const chars = row.chars.find((c) => c.includes(k))
        const at = chars ? chars.indexOf(k) / (chars.length - 1) : Math.random() // (punctuation: anywhere along the top)
        place(row.keys[Math.round(at * (row.keys.length - 1))], row.v, 1)
      }
      // and the whole thing rocks a hair (it eases back by itself while it's resting)
      if (onRock()) keyboard.rotation.x += ROCK
    },
    update: (dt) => {
      for (const c of caps) {
        if (!c.cap.visible) continue
        c.left -= dt
        if (c.left <= 0) c.cap.visible = false
      }
    },
  }
}

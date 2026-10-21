import { useEffect, useRef, useState } from 'react'
import { useStore, TASKBAR_H } from '../store'
import { devices } from '../data/devices'
import { useSlumpy } from './slumpy'
import { playBark, playSqueak } from './sound'

// Slumpy's pets, living along the bottom of the desktop (the OS only; in the room
// they're his keyboard and mouse): Chiba, a little Shiba Inu (one letter off),
// and Hanzo, a mouse. They wander about, sit, nap and nibble, and every so often
// Chiba chases Hanzo. Click (or tap) one: Chiba barks and gets a heart, Hanzo
// squeaks and hops, and Slumpy looks on lovingly. They're behind the windows, so
// they never get in the way. (Unplugged in the room, they're not here.)

// pixel art, facing right; each letter a color (see PAL)
const PAL: Record<string, string> = {
  k: '#1e161c',
  o: '#e28036',
  c: '#fae2be',
  n: '#140e12',
  g: '#9696a2',
  l: '#cdcdd6',
  p: '#ff96aa',
}
const CHIBA = {
  walkA: [
    '...........k..k..',
    '..........kok.kok',
    '.kk.......koookok',
    'kook.....kooooook',
    'koook....kookoooc',
    '.kook...kooooocnk',
    '..koookkoooooocck',
    '...koooooooooock.',
    '...kocccccccccck.',
    '....kcccccccccok.',
    '....kok.kk..kok..',
    '...kok.....kok...',
    '...kk.....kk.....',
  ],
  walkB: [
    '...........k..k..',
    '..........kok.kok',
    '.kk.......koookok',
    'kook.....kooooook',
    'koook....kookoooc',
    '.kook...kooooocnk',
    '..koookkoooooocck',
    '...koooooooooock.',
    '...kocccccccccck.',
    '....kcccccccccok.',
    '.....kok....kok..',
    '.....kok....kok..',
    '.....kk.....kk...',
  ],
  sit: [
    '...........k..k..',
    '..........kok.kok',
    '..........koookok',
    '.........kooooook',
    '.........kookoooc',
    '.kk.....kooooocnk',
    'kook...koooooocck',
    'koook.koooooock..',
    '.kooookocccccck..',
    '..kooooccccccck..',
    '...kooocccccok...',
    '...koookkkkkok...',
    '...kkkk.kok.kk...',
  ],
  sleep: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '...........k..k...',
    '..kkk.....kok.kok.',
    '.koook...kooooook.',
    'koooookkkkooooooo.',
    'kooocccccokkooccn.',
    '.kocccccccccooock.',
    '..kkkkkkkkkkkkkk..',
    '..................',
  ],
}
const HANZO = {
  runA: [
    '......kk.....',
    '.....kpgk....',
    '....klggggk..',
    '...kgggggnkk.',
    'pp.kggggggggp',
    '..pkgggggggk.',
    '...kkkgggkk..',
    '....k....k...',
  ],
  runB: [
    '......kk.....',
    '.....kpgk....',
    '....klggggk..',
    '...kgggggnkk.',
    '.ppkggggggggp',
    'p..kgggggggk.',
    '...kkkgggkk..',
    '...k......k..',
  ],
  sit: [
    '.....kk......',
    '....kpgk.....',
    '...klgggk....',
    '...kggggnkk..',
    '...kgggggggp.',
    'pp.kggggggk..',
    '..pkggkggk...',
    '...kkk.kk....',
  ],
}

export function Sprite({ rows, scale }: { rows: readonly string[]; scale: number }) {
  const w = rows[0].length
  const h = rows.length
  return (
    <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((row, y) => [...row].map((ch, x) => (PAL[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PAL[ch]} /> : null)))}
    </svg>
  )
}

// each one sitting (System Settings > Devices shows them)
export const PET_PORTRAIT = { keyboard: CHIBA.sit, mouse: HANZO.sit }

type Mode = 'walk' | 'sit' | 'sleep' | 'chase' | 'flee' | 'hop'
type Pet = { x: number; goal: number; mode: Mode; until: number; facing: 1 | -1; hearts: number }
const SPEED: Record<Mode, number> = { walk: 34, chase: 95, flee: 115, hop: 0, sit: 0, sleep: 0 }
const SCALE = 3
const WIDTH = { chiba: CHIBA.walkA[0].length * SCALE, hanzo: HANZO.runA[0].length * SCALE }
const rand = (a: number, b: number) => a + Math.random() * (b - a)

export function Pets() {
  const width = useStore((s) => s.desk.w)
  const unplugged = useStore((s) => s.unplugged)
  const slumpy = useSlumpy()
  const pets = useRef<Record<'chiba' | 'hanzo', Pet>>({
    chiba: { x: width * 0.35, goal: width * 0.35, mode: 'sit', until: 0, facing: 1, hearts: 0 },
    hanzo: { x: width * 0.6, goal: width * 0.6, mode: 'sit', until: 0, facing: -1, hearts: 0 },
  })
  const [, redraw] = useState(0)

  useEffect(() => {
    let last = performance.now()
    let raf = 0
    let frame = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const t = now / 1000
      const { chiba, hanzo } = pets.current
      const max = Math.max(60, width - 60)
      // what to do next, once the last thing's done
      const next = (pet: Pet, kind: 'chiba' | 'hanzo') => {
        if (pet.mode === 'chase' || pet.mode === 'flee' || pet.mode === 'hop') return
        if (pet.mode === 'walk' ? Math.abs(pet.goal - pet.x) > 2 : t < pet.until) return
        const r = Math.random()
        if (kind === 'chiba' && r < 0.12) {
          // a chase!
          chiba.mode = 'chase'
          hanzo.mode = 'flee'
          chiba.until = hanzo.until = t + rand(2.5, 4)
        } else if (r < 0.5) {
          pet.mode = 'walk'
          pet.goal = rand(30, max)
        } else if (kind === 'chiba' && r < 0.68) {
          pet.mode = 'sleep'
          pet.until = t + rand(6, 11)
        } else {
          pet.mode = 'sit'
          pet.until = t + rand(1.5, 4)
        }
      }
      next(chiba, 'chiba')
      next(hanzo, 'hanzo')
      // moving: toward its goal, or (chasing) after Hanzo, or (fleeing) away from Chiba
      for (const pet of [chiba, hanzo]) {
        if (pet.mode === 'chase') pet.goal = hanzo.x
        if (pet.mode === 'flee') {
          const away = pet.x - chiba.x >= 0 ? 1 : -1
          pet.goal = pet.x + away * 80
          if (pet.goal > max || pet.goal < 30) pet.goal = pet.x - away * 80 // (cornered: doubles back)
        }
        const d = pet.goal - pet.x
        if (SPEED[pet.mode] && Math.abs(d) > 1) {
          pet.facing = d > 0 ? 1 : -1
          pet.x += Math.sign(d) * Math.min(Math.abs(d), SPEED[pet.mode] * dt)
        }
        pet.x = Math.min(max, Math.max(10, pet.x))
        if ((pet.mode === 'chase' || pet.mode === 'flee' || pet.mode === 'hop') && t > pet.until) {
          pet.mode = 'sit'
          pet.until = t + rand(1, 2.5)
        }
        pet.hearts = Math.max(0, pet.hearts - dt)
      }
      // caught up: they both stop for a breather
      if (chiba.mode === 'chase' && Math.abs(chiba.x - hanzo.x) < 18) chiba.until = hanzo.until = Math.min(chiba.until, t + 0.2)
      if (++frame % 6 === 0) redraw((n) => n + 1) // (about 10 times a second is plenty for pixel art)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [width])

  const step = Math.floor((performance.now() / 1000) * 6) % 2 // walking frames
  const { chiba, hanzo } = pets.current
  const moving = (p: Pet) => SPEED[p.mode] > 0 && Math.abs(p.goal - p.x) > 1
  const chibaRows = chiba.mode === 'sleep' ? CHIBA.sleep : moving(chiba) ? (step ? CHIBA.walkA : CHIBA.walkB) : CHIBA.sit
  const hanzoRows = moving(hanzo) ? (step ? HANZO.runA : HANZO.runB) : HANZO.sit

  // a pat: Chiba barks and sits for a moment, Hanzo squeaks and hops
  const pat = (kind: 'chiba' | 'hanzo') => () => {
    const p = pets.current[kind]
    const now = performance.now() / 1000
    if (kind === 'chiba') {
      playBark()
      p.mode = 'sit'
      p.until = now + 2
    } else {
      playSqueak()
      p.mode = 'hop'
      p.until = now + 0.5
    }
    p.hearts = 1.2
    slumpy.react('love', 1.4)
  }

  return (
    <div className="pets" style={{ bottom: TASKBAR_H }}>
      {!unplugged.keyboard && (
        <button
          className={`pet chiba ${chiba.mode}`}
          style={{ left: chiba.x - WIDTH.chiba / 2 }}
          title={`${devices.keyboard.name}, Slumpy's dog`}
          aria-label={`${devices.keyboard.name}, Slumpy's dog`}
          onClick={pat('chiba')}
        >
          <span className="pet-body" style={{ transform: `scaleX(${chiba.facing})` }}>
            <Sprite rows={chibaRows} scale={SCALE} />
          </span>
          {chiba.mode === 'sleep' && <span className="pet-z">z</span>}
          {chiba.hearts > 0 && <span className="pet-heart">♥</span>}
        </button>
      )}
      {!unplugged.mouse && (
        <button
          className={`pet hanzo ${hanzo.mode}`}
          style={{ left: hanzo.x - WIDTH.hanzo / 2 }}
          title={`${devices.mouse.name}, Slumpy's mouse`}
          aria-label={`${devices.mouse.name}, Slumpy's mouse`}
          onClick={pat('hanzo')}
        >
          <span className="pet-body" style={{ transform: `scaleX(${hanzo.facing})` }}>
            <Sprite rows={hanzoRows} scale={SCALE} />
          </span>
          {hanzo.hearts > 0 && <span className="pet-heart">♥</span>}
        </button>
      )}
    </div>
  )
}

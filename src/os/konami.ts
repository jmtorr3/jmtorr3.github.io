import { useStore } from '../store'
import { getFace } from './slumpy'
import { playFaceSound } from './sound'

// Easter egg: ↑ ↑ ↓ ↓ ← → ← → B A, anywhere. Disco mode: the whole page cycles
// through the colors for a few seconds and Slumpy dances (in the room, PCModel
// picks it up from the store).

const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const DISCO_MS = 8000

const style = document.createElement('style')
style.textContent = `
  html.disco #root { animation: slumpy-disco 0.9s linear infinite; }
  @keyframes slumpy-disco {
    from { filter: hue-rotate(0deg) saturate(1.7); }
    to { filter: hue-rotate(360deg) saturate(1.7); }
  }
`
document.head.appendChild(style)

let at = 0
let timer = 0

window.addEventListener(
  'keydown',
  (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    if (key !== CODE[at]) {
      at = key === CODE[0] ? 1 : 0
      return
    }
    // the B and A that finish it aren't typing (in the Konsole or at Slumpy)
    if (at >= 8) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    if (++at < CODE.length) return
    at = 0
    useStore.setState({ disco: performance.now() + DISCO_MS })
    document.documentElement.classList.add('disco')
    getFace().react('music', DISCO_MS / 1000)
    playFaceSound('music')
    clearTimeout(timer)
    timer = window.setTimeout(() => document.documentElement.classList.remove('disco'), DISCO_MS)
  },
  true, // before anything else sees the B and A
)

import { Scene } from './scene/Scene'
import { Desktop } from './os/Desktop'
import { useStore } from './store'

const TOUCH = matchMedia('(pointer: coarse)').matches

export function App() {
  const mode = useStore((s) => s.mode)
  return (
    <>
      <Scene />
      {mode === 'room' && <div className="hint">{TOUCH ? 'tap' : 'click'} the computer</div>}
      {mode === 'desktop' && <Desktop />}
    </>
  )
}

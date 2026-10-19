import { Scene } from './scene/Scene'
import { Desktop } from './os/Desktop'
import { useStore } from './store'

export function App() {
  const mode = useStore((s) => s.mode)
  return (
    <>
      <Scene />
      {mode === 'room' && <div className="hint">click the computer</div>}
      {mode === 'desktop' && <Desktop />}
    </>
  )
}

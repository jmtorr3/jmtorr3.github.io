import { Scene } from './scene/Scene'
import { Desktop } from './os/Desktop'
import { useStore } from './store'
import { FullscreenButton } from './FullscreenButton'
import { devices } from './data/devices'

const TOUCH = matchMedia('(pointer: coarse)').matches

export function App() {
  const mode = useStore((s) => s.mode)
  const device = useStore((s) => s.hoverDevice)
  return (
    <>
      <Scene />
      {mode === 'room' && (
        <div className="hint">{device ? `${devices[device].name}, the ${devices[device].type.toLowerCase()}` : `${TOUCH ? 'tap' : 'click'} the computer`}</div>
      )}
      {mode === 'desktop' && <Desktop />}
      <FullscreenButton />
    </>
  )
}

import { Scene } from './scene/Scene'
import { Desktop } from './os/Desktop'
import { useStore } from './store'
import { FullscreenButton } from './FullscreenButton'
import { devices } from './data/devices'
import { PowerHint } from './scene/PowerHint'

const TOUCH = matchMedia('(pointer: coarse)').matches

export function App() {
  const mode = useStore((s) => s.mode)
  const device = useStore((s) => s.hoverDevice)
  const off = useStore((s) => s.poweredOff)
  return (
    <>
      <Scene />
      {mode === 'room' && (
        <div className="hint">
          {device ? `${devices[device].name}, the ${devices[device].type.toLowerCase()}` : off ? 'press the power button' : `${TOUCH ? 'tap' : 'click'} the computer`}
        </div>
      )}
      {mode === 'room' && <PowerHint />}
      {mode === 'desktop' && <Desktop />}
      <FullscreenButton />
    </>
  )
}

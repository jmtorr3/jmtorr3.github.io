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
  const brainless = useStore((s) => s.brainOut)
  const booting = useStore((s) => s.booting) // the boot log is up: it heads into the sign-in by itself
  const rebooting = useStore((s) => s.rebooting) // off for a moment, coming back on by itself
  return (
    <>
      <Scene />
      {mode === 'room' && !booting && !rebooting && (
        <div className="hint">
          {device ? `${devices[device].name}, the ${devices[device].type.toLowerCase()}` : brainless ? 'put my brain back' : off ? 'press the power button' : `${TOUCH ? 'tap' : 'click'} the computer`}
        </div>
      )}
      {mode === 'room' && <PowerHint />}
      {mode === 'desktop' && <Desktop />}
      <FullscreenButton />
    </>
  )
}

import { Scene } from './scene/Scene'
import { Desktop } from './os/Desktop'
import { AppHost } from './os/appHost'
import { useStore } from './store'
import { FullscreenButton } from './FullscreenButton'
import { devices } from './data/devices'
import { PowerHint } from './scene/PowerHint'
import { RoomKeyboard } from './scene/RoomKeyboard'

const TOUCH = matchMedia('(pointer: coarse)').matches

export function App() {
  const mode = useStore((s) => s.mode)
  const device = useStore((s) => s.hoverDevice)
  const off = useStore((s) => s.poweredOff)
  const brainless = useStore((s) => s.brainOut)
  const unplugged = useStore((s) => s.unplugged)
  const missing = (['keyboard', 'mouse'] as const).filter((k) => unplugged[k]).map((k) => devices[k].name)
  const booting = useStore((s) => s.booting) // the boot log is up: it heads into the sign-in by itself
  const rebooting = useStore((s) => s.rebooting) // off for a moment, coming back on by itself
  return (
    <>
      <Scene />
      {mode === 'room' && !booting && !rebooting && (
        <div className="hint">
          {device ? `${devices[device].name}, the ${devices[device].type.toLowerCase()}` : brainless
              ? 'put my brain back'
              : off
                ? 'press the power button'
                : missing.length
                  ? `plug ${missing.join(' and ')} back in: ${TOUCH ? 'tap' : 'click'} ${missing.length > 1 ? 'their plugs' : 'its plug'} (back of the case)`
                  : TOUCH ? 'tap the computer · tap the keyboard to talk' : 'click the computer'}
        </div>
      )}
      {mode === 'room' && <PowerHint />}
      {mode === 'room' && TOUCH && <RoomKeyboard />}
      {mode === 'desktop' && <Desktop />}
      {/* the apps in its windows keep running in the room (see appHost) */}
      <AppHost />
      <FullscreenButton />
    </>
  )
}

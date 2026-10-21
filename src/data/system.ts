// "About This Computer" (desktop right-click). Slumpy's made-up specs, shown as
// label / value rows. The name comes from profile.host.

import { devices } from './devices'

export const systemTagline = 'a small beige computer. mostly harmless.'

// also shown under the name in the Start menu
export const systemOS = 'slumpyOS 1.0'

export const systemSpecs: { label: string; value: string }[] = [
  { label: 'Model', value: 'SLMP-64 Beige Edition (1997)' },
  { label: 'Processor', value: '1× Slumpy Core @ 4.77 MHz (turbo button: decorative)' },
  { label: 'Memory', value: '640 KB, which should be enough for anybody' },
  { label: 'Graphics', value: 'picoCAD dither, 4 shades per color' },
  { label: 'Display', value: '15" CRT, 5:4, needs a second to warm up' },
  { label: 'Storage', value: '1.44 MB floppy: a few projects, one resume' },
  { label: 'Sound', value: 'a beeper, a fan, opinions' },
  { label: 'Keyboard', value: `${devices.keyboard.name} (${devices.keyboard.model})` },
  { label: 'Mouse', value: `${devices.mouse.name} (${devices.mouse.model})` },
  { label: 'Cooling', value: 'one rear fan. do not click it' },
  { label: 'Operating System', value: `${systemOS} (React + three.js)` },
]

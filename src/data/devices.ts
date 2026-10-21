// Slumpy's keyboard and mouse: the two on the desk in the room (they can be
// picked up and thrown around, and unplugged from the back of the case), and
// his pets on the desktop: Chiba's a Shiba Inu, Hanzo's a mouse (see Pets).
// Shown in System Settings > Devices, in the Konsole's `lsusb`, and as the
// hint when hovering one in the room.

export type DeviceKind = 'keyboard' | 'mouse'

export const devices: Record<DeviceKind, { name: string; type: string; model: string; usbId: string; note: string; pet: string; petNote: string }> = {
  keyboard: {
    name: 'Chiba',
    type: 'Keyboard',
    model: 'SLMP KB-101, beige, 101 keys',
    usbId: '511d:0101',
    note: 'clacky. has been thrown and is fine about it.',
    pet: 'Shiba Inu',
    petNote: "Slumpy's dog. naps a lot, chases Hanzo, barks when patted. very good dog.",
  },
  mouse: {
    name: 'Hanzo',
    type: 'Mouse',
    model: 'SLMP Ball Mouse, 2 buttons',
    usbId: '511d:0102',
    note: 'follows the cursor around. the ball needs cleaning.',
    pet: 'Mouse',
    petNote: "Slumpy's mouse. scurries, squeaks, nibbles. faster than Chiba (usually).",
  },
}

export const DEVICE_KINDS = Object.keys(devices) as DeviceKind[]

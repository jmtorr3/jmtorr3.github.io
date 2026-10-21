import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'

// Easter egg: a 3.5" floppy drive in the front of the case (the model doesn't
// have one). Click the slot and a labelled disk ejects; click the disk and it
// goes back in and the PC boots straight into About My Creator (see PCModel).

// the slot: middle of the front panel, low down (the PC faces -z)
const SLOT = { at: new THREE.Vector3(0.52, 0.15, 0.4375), w: 0.28, h: 0.034, depth: 0.012 }
// the slot's thin: clicks this close around it count too (an invisible box in front of it)
const SLOT_TARGET = { w: 0.32, h: 0.11 }
// the disk lies flat and slides in and out along z; this much of it sticks out when ejected
const DISK = { w: 0.24, thick: 0.016, len: 0.24, out: 0.7 }

const solid = (rgb: [number, number, number]) => makePicoMaterial(new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1))

// a paper label with a couple of lines of "handwriting" (8×8, nearest filtered)
function labelMaterial() {
  const px = new Uint8Array(8 * 8 * 4)
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const ink = (y === 2 && x > 0 && x < 7) || (y === 5 && x > 0 && x < 5)
      const v = ink ? [0x3a, 0x3a, 0x6a] : [0xf2, 0xee, 0xe2]
      px.set([...v, 255], (y * 8 + x) * 4)
    }
  return makePicoMaterial(new THREE.DataTexture(px, 8, 8))
}

export type Floppy = {
  group: THREE.Group
  slot: THREE.Mesh
  slotTarget: THREE.Mesh
  disk: THREE.Group
  has: (o: THREE.Object3D) => boolean // part of the disk?
  setOut: (k: number) => void // 0 all the way in (hidden) .. 1 ejected
}

export function makeFloppy(): Floppy {
  const slot = new THREE.Mesh(new THREE.BoxGeometry(SLOT.w, SLOT.h, SLOT.depth), solid([0x1a, 0x1a, 0x22]))
  slot.position.set(SLOT.at.x, SLOT.at.y, SLOT.at.z - SLOT.depth / 2 + 0.002) // barely proud of the panel
  const slotTarget = new THREE.Mesh(new THREE.BoxGeometry(SLOT_TARGET.w, SLOT_TARGET.h, 0.02), new THREE.MeshBasicMaterial({ visible: false }))
  slotTarget.position.set(SLOT.at.x, SLOT.at.y, SLOT.at.z - 0.01)

  // the disk, built along +z (into the drive) from its outside end at z = 0
  const disk = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(DISK.w, DISK.thick, DISK.len), solid([0x2b, 0x3a, 0x67]))
  body.position.z = DISK.len / 2
  // the metal shutter goes in first; the label's on the end you hold
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(DISK.w * 0.45, DISK.thick + 0.002, DISK.len * 0.35), solid([0xa9, 0xaf, 0xbb]))
  shutter.position.set(-DISK.w * 0.1, 0, DISK.len * 0.78)
  const label = new THREE.Mesh(new THREE.BoxGeometry(DISK.w * 0.7, DISK.thick + 0.002, DISK.len * 0.3), labelMaterial())
  label.position.set(0, 0, DISK.len * 0.2)
  disk.add(body, shutter, label)
  disk.position.set(SLOT.at.x, SLOT.at.y, SLOT.at.z)
  disk.visible = false

  const parts = new Set<THREE.Object3D>([body, shutter, label])
  const group = new THREE.Group()
  group.add(slot, slotTarget, disk)
  return {
    group,
    slot,
    slotTarget,
    disk,
    has: (o) => parts.has(o),
    setOut: (k) => {
      // in: entirely behind the panel (and hidden); out: DISK.out of it sticking out
      disk.position.z = SLOT.at.z + 0.01 - DISK.len * DISK.out * k
      disk.visible = k > 0.01
    },
  }
}

import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'

// December: a Santa hat on top of the monitor, flopped over to one side.
// Low-poly (eight sides), shaded like the rest of the PC.

const solid = (rgb: [number, number, number]) => makePicoMaterial(new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1))

// the top of the monitor's front (its highest part), where the hat sits
const AT = new THREE.Vector3(0.5625, 1.6875, 0.72)

export function makeSantaHat() {
  const red = solid([0xd8, 0x2a, 0x34])
  const white = solid([0xf4, 0xf1, 0xe8])
  const hat = new THREE.Group()
  // the brim: a fat white ring, roughly the width of the monitor's top
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 8), white)
  brim.position.y = 0.035
  // the red cone, leaning over (pivoting at the brim)
  const lean = new THREE.Group()
  lean.position.y = 0.06
  lean.rotation.z = -0.55
  lean.rotation.x = -0.2
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.42, 8), red)
  cone.position.y = 0.21
  const pompom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), white)
  pompom.position.y = 0.43
  lean.add(cone, pompom)
  hat.add(brim, lean)
  hat.position.copy(AT)
  hat.rotation.y = 0.3
  return hat
}

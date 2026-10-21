import * as THREE from 'three'

// The PC as boxes, for things that bump into it (the brain) or lie against it
// (the cables): the case, and the monitor on its stand
export const SOLIDS = [
  new THREE.Box3(new THREE.Vector3(-0.125, 0, 0.4375), new THREE.Vector3(1.25, 0.375, 1.4375)),
  new THREE.Box3(new THREE.Vector3(-0.0625, 0.375, 0.5625), new THREE.Vector3(1.1875, 1.6875, 1.5)),
]

// A point (a bit of cable, r thick) that's ended up inside the PC: out the shortest
// way (never down through the desk)
export function pushOut(p: THREE.Vector3, r: number) {
  for (const box of SOLIDS) {
    if (p.x < box.min.x - r || p.x > box.max.x + r || p.y < box.min.y - r || p.y > box.max.y + r || p.z < box.min.z - r || p.z > box.max.z + r) continue
    const pushes: [number, 'x' | 'y' | 'z', number][] = [
      [p.x - (box.min.x - r), 'x', -1],
      [box.max.x + r - p.x, 'x', 1],
      [box.max.y + r - p.y, 'y', 1],
      [p.z - (box.min.z - r), 'z', -1],
      [box.max.z + r - p.z, 'z', 1],
    ]
    if (box.min.y > 0) pushes.push([p.y - (box.min.y - r), 'y', -1])
    const [depth, axis, dir] = pushes.reduce((a, b) => (b[0] < a[0] ? b : a))
    p[axis] += depth * dir
  }
  return p
}

// A cable's curve, kept out of the PC: sampled, pushed out, and smoothed again.
// skip: whether a point's meant to be inside (a cable going in through an opening)
export function aroundPC(curve: THREE.Curve<THREE.Vector3>, r: number, samples = 40, skip?: (p: THREE.Vector3) => boolean) {
  const pts = curve.getSpacedPoints(samples).map((p) => (skip?.(p) ? p : pushOut(p, r)))
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

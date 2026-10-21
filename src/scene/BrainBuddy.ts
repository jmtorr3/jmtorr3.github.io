import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'
import { SlumpyFace, type Expression } from './SlumpyFace'

// The brain, left lying out of the PC, comes alive (see Brain): Slumpy's face on
// its front, two legs to walk on and two arms to swing (or climb with). These are
// the bits and how they move; Brain walks it around and up the back of the PC, home,
// and leans and bobs the brain itself by the pose this gives back.
// (It's built facing +z: Brain turns it to face the brain's own front.)

const LIMB = { thick: 0.032, thigh: 0.09, shin: 0.09, upper: 0.07, fore: 0.07 }
const SKIN = [0xc7, 0x72, 0x8a] as [number, number, number] // a deeper pink than the brain

// how it's moving: phase is the step (or reach) cycle in radians; the rest blend 0..1
export type BuddyMotion = {
  phase: number
  walk: number // striding
  climb: number // hand over hand up a wall
  wave: number // waving at you (its right arm)
  crouch: number // squatting down (getting up off the desk)
  shuffle: number // turning on the spot, little steps
  time: number // seconds, for breathing and fidgets
}
// what the body does to go with it: bob up and down, rock side to side, lean forward (radians)
export type BuddyPose = { bob: number; roll: number; lean: number }

export type BrainBuddy = {
  group: THREE.Group
  legHeight: number // how far its feet are below the brain's bottom, standing straight
  show: (on: boolean) => void
  feel: (expr: Expression | null) => void // its face: an expression, or null for its own idle moods
  animate: (dt: number, m: BuddyMotion) => BuddyPose
}

// body: the brain's size, in its own space turned to face +z (the limbs and face go round it)
export function makeBrainBuddy(body: THREE.Box3): BrainBuddy {
  const group = new THREE.Group()
  group.visible = false
  const skin = makePicoMaterial(new THREE.DataTexture(new Uint8Array([...SKIN, 255]), 1, 1))
  const box = (w: number, h: number, d: number, y: number, z = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d)
    geo.translate(0, y, z)
    const m = new THREE.Mesh(geo, skin)
    m.raycast = () => {}
    return m
  }
  // a two-part limb: the top pivots at the hip or shoulder, the bottom at the knee or
  // elbow; each part hangs down from its pivot, so turning a pivot swings what's below
  const limb = (x: number, y: number, top: number, bottom: number, end: THREE.Mesh) => {
    const joint = new THREE.Group()
    joint.position.set(x, y, 0)
    joint.add(box(LIMB.thick, top, LIMB.thick, -top / 2))
    const lower = new THREE.Group()
    lower.position.y = -top
    lower.add(box(LIMB.thick * 0.9, bottom, LIMB.thick * 0.9, -bottom / 2))
    end.position.y = -bottom
    lower.add(end)
    joint.add(lower)
    group.add(joint)
    return { joint, lower }
  }
  const w = (body.max.x - body.min.x) / 2
  const midY = (body.min.y + body.max.y) / 2
  const foot = () => box(LIMB.thick * 1.6, LIMB.thick * 0.8, LIMB.thick * 2.4, 0, LIMB.thick * 0.6)
  const hand = () => box(LIMB.thick * 1.5, LIMB.thick * 1.3, LIMB.thick * 1.2, -LIMB.thick * 0.3)
  const hipY = body.min.y + 0.05
  const legs = [limb(-w * 0.35, hipY, LIMB.thigh, LIMB.shin, foot()), limb(w * 0.35, hipY, LIMB.thigh, LIMB.shin, foot())]
  const arms = [limb(-w * 0.95, midY, LIMB.upper, LIMB.fore, hand()), limb(w * 0.95, midY, LIMB.upper, LIMB.fore, hand())]

  // his face, on the front (+z), from its own SlumpyFace (idle moods and all)
  const face = new SlumpyFace({ transparent: true })
  const faceH = (body.max.y - body.min.y) * 0.62
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(faceH * 1.25, faceH),
    new THREE.MeshBasicMaterial({ map: face.texture, transparent: true, depthWrite: false }),
  )
  plane.position.set(0, midY + faceH * 0.1, body.max.z + 0.004)
  plane.raycast = () => {}
  group.add(plane)

  let feeling: Expression | null = null
  const legLength = LIMB.thigh + LIMB.shin

  return {
    group,
    legHeight: legLength + LIMB.thick * 0.4 - 0.05,
    show: (on) => {
      group.visible = on
      feeling = null
      face.set(on ? null : 'off') // (wakes up, eyes opening)
    },
    feel: (expr) => {
      if (expr === feeling) return
      feeling = expr
      face.set(expr)
    },
    animate: (dt, m) => {
      face.update(dt)
      const { phase, walk, climb, wave, crouch, shuffle, time } = m
      const stride = Math.max(walk, shuffle * 0.5)
      // legs: each swings through, its knee bending as it comes forward (the foot
      // lifting clear), straight while it's taking the weight; climbing, they push
      // off the wall in turn, knees well bent
      legs.forEach((leg, i) => {
        const p = phase + i * Math.PI
        const swing = Math.sin(p) * 0.55 * stride
        const lift = Math.max(0, Math.cos(p)) * 0.95 * stride
        const climbHip = -0.5 - Math.sin(p) * 0.45
        const climbKnee = 0.9 + Math.max(0, Math.sin(p)) * 0.6
        leg.joint.rotation.x = THREE.MathUtils.lerp(swing - crouch * 1.1, climbHip, climb)
        leg.lower.rotation.x = THREE.MathUtils.lerp(lift + crouch * 2.0, climbKnee, climb)
        leg.joint.rotation.z = (i ? -1 : 1) * (0.04 + crouch * 0.12)
      })
      // arms: swinging opposite the legs, elbows a little bent; climbing they reach up
      // over its head in turn and pull down; waving, the right one's up, hand going
      // side to side
      arms.forEach((arm, i) => {
        const side = i ? 1 : -1
        const p = phase + i * Math.PI
        const fidget = Math.sin(time * 1.7 + i) * 0.04
        let shoulder = -Math.sin(p) * 0.55 * stride + fidget
        let elbow = 0.25 + 0.35 * stride + Math.max(0, -Math.sin(p)) * 0.3 * stride
        let out = side * (0.3 + crouch * 0.3)
        let twist = 0
        shoulder = THREE.MathUtils.lerp(shoulder, -2.75 + Math.sin(p) * 0.55, climb)
        elbow = THREE.MathUtils.lerp(elbow, 0.2 + Math.max(0, -Math.sin(p)) * 1.1, climb)
        out = THREE.MathUtils.lerp(out, side * 0.25, climb)
        if (i === 1 && wave > 0) {
          shoulder = THREE.MathUtils.lerp(shoulder, -2.5, wave)
          out = THREE.MathUtils.lerp(out, 0.5, wave)
          elbow = THREE.MathUtils.lerp(elbow, 0.5, wave)
          twist = Math.sin(time * 11) * 0.7 * wave
        }
        arm.joint.rotation.set(shoulder, 0, out)
        arm.lower.rotation.set(-elbow, 0, twist)
      })
      // the body: bobbing twice a stride (highest as a leg passes under), rocking onto
      // the foot that's down, leaning into its steps; standing, it breathes and shifts
      // its weight; climbing, it heaves up with each pull
      const still = (1 - stride) * (1 - climb)
      const bob =
        (Math.abs(Math.cos(phase)) - 0.5) * 0.035 * walk +
        Math.sin(time * 2.2) * 0.006 * still +
        Math.sin(phase * 2) * 0.012 * climb -
        crouch * legLength * 0.55
      const roll = Math.sin(phase) * 0.09 * stride + Math.sin(time * 0.7) * 0.035 * still + Math.sin(phase) * 0.08 * climb
      const lean = 0.16 * walk + 0.12 * climb + crouch * 0.25 - wave * 0.05
      return { bob, roll, lean }
    },
  }
}

import * as THREE from 'three'

// The keyboard and mouse can be picked up and dropped around the desk. They stay
// where they land until the desktop is shut down, then glide back home.

// while something is held, the camera doesn't orbit (CameraRig checks this)
export const grabState = { active: false }

const LIFT = 0.45 // how high a held prop floats above the desk
const MAX_LIFT = 1.4 // how high it can be raised when moving it up and down
// a knock only plays if the prop hasn't touched the PC for this long (seconds),
// so sliding along it or wiggling against it while held stays quiet
const KNOCK_GAP = 0.5
const GRAVITY = 7
const BOUNDS = 2.4 // how far from the PC a prop can go

type State = 'rest' | 'held' | 'fall' | 'home'
export type PropKind = 'keyboard' | 'mouse'

export type Prop = {
  kind: PropKind
  mesh: THREE.Object3D
  rest: THREE.Vector3 // where it started (and goes back to)
  restRot: THREE.Euler
  anchor: THREE.Vector3 // where it's sitting now (the desk mouse wiggles around this)
  vel: THREE.Vector3
  state: State
  offset: THREE.Vector3 // bounding-box center relative to the mesh position
  half: THREE.Vector3 // half the bounding-box size
  lastTouch: number // when it last touched the PC (for KNOCK_GAP)
}

export class DeskProps {
  readonly props: Prop[]
  private held: Prop | null = null
  private grabOffset = new THREE.Vector3()
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT)
  private hit = new THREE.Vector3()
  private target = new THREE.Vector3()
  private last = new THREE.Vector3()
  private n = new THREE.Vector3()
  private time = 0
  // how fast the pointer is moving the held prop (its target), smoothed: a held
  // prop chases a target that may be deep inside the PC, so its own speed says
  // little about how hard it was swung
  private aimVel = new THREE.Vector3()
  private lastAim = new THREE.Vector3()
  private aimReady = false

  // for sounds: picked up, hit the desk, knocked into the PC (speed in units/s)
  onGrab?: (p: Prop) => void
  onLand?: (p: Prop, speed: number) => void
  onBump?: (p: Prop, speed: number) => void

  // obstacle: the PC's footprint. Props can't go into it, and they can't go further
  // back than its middle (the PC faces -z), so they never end up behind it.
  constructor(items: { mesh: THREE.Object3D; kind: PropKind }[], private obstacle: THREE.Box3, private center: THREE.Vector3) {
    this.props = items.map(({ mesh, kind }) => {
      const box = new THREE.Box3().setFromObject(mesh)
      return {
        kind,
        mesh,
        rest: mesh.position.clone(),
        restRot: mesh.rotation.clone(),
        anchor: mesh.position.clone(),
        vel: new THREE.Vector3(),
        state: 'rest' as State,
        offset: box.getCenter(new THREE.Vector3()).sub(mesh.position),
        half: box.getSize(new THREE.Vector3()).multiplyScalar(0.5),
        lastTouch: -Infinity,
      }
    })
  }

  find(obj: THREE.Object3D) {
    return this.props.find((p) => p.mesh === obj) ?? null
  }

  get holding() {
    return this.held !== null
  }

  // camDir: where the camera is looking. The held prop moves on a surface through
  // it that tilts with the view: looking straight at the PC it's upright, so moving
  // the pointer up and down raises and lowers the prop; looking down from above
  // it's the desk plane, so up and down is forward and back.
  grab(prop: Prop, ray: THREE.Ray, camDir: THREE.Vector3) {
    const down = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(-camDir.y, -1, 1)))
    const upright = THREE.MathUtils.clamp((50 - down) / 30, 0, 1) // 1 at <=20° down, 0 at >=50°
    // blend between facing the camera (upright) and facing up (the desk plane)
    this.n.set(-camDir.x, 0, -camDir.z).normalize().multiplyScalar(upright)
    this.n.y += 1 - upright
    this.n.normalize()
    // through the prop, at the height it gets lifted to
    this.target.copy(prop.mesh.position).setY(prop.rest.y + LIFT)
    this.plane.setFromNormalAndCoplanarPoint(this.n, this.target)
    if (!ray.intersectPlane(this.plane, this.hit)) return
    // keep the grab point under the pointer, lifted to LIFT right away
    this.grabOffset.copy(this.target).sub(this.hit)
    prop.state = 'held'
    this.held = prop
    this.aimReady = false
    this.aimVel.set(0, 0, 0)
    grabState.active = true
    this.onGrab?.(prop)
  }

  release() {
    if (!this.held) return
    this.held.state = 'fall'
    this.held = null
    grabState.active = false
  }

  // send everything back where it started
  reset() {
    this.release()
    for (const p of this.props) p.state = 'home'
  }

  update(dt: number, ray: THREE.Ray) {
    this.time += dt
    for (const p of this.props) {
      const pos = p.mesh.position
      if (p.state === 'held') {
        if (!ray.intersectPlane(this.plane, this.hit)) continue
        this.target.copy(this.hit).add(this.grabOffset)
        this.target.y = THREE.MathUtils.clamp(this.target.y, p.rest.y + 0.1, p.rest.y + MAX_LIFT)
        if (this.aimReady) this.aimVel.lerp(this.n.copy(this.target).sub(this.lastAim).divideScalar(Math.max(dt, 1e-3)), 0.3)
        this.lastAim.copy(this.target)
        this.aimReady = true
        this.last.copy(pos)
        pos.lerp(this.target, 1 - Math.exp(-dt * 20))
        p.vel.copy(pos).sub(this.last).divideScalar(Math.max(dt, 1e-3))
        // swing with the motion
        p.mesh.rotation.z = p.restRot.z + THREE.MathUtils.clamp(-p.vel.x * 0.08, -0.5, 0.5)
        p.mesh.rotation.x = p.restRot.x + THREE.MathUtils.clamp(p.vel.z * 0.08, -0.5, 0.5)
        this.collide(p)
      } else if (p.state === 'fall') {
        p.vel.y -= GRAVITY * dt
        pos.addScaledVector(p.vel, dt)
        const grounded = pos.y <= p.rest.y
        if (grounded) {
          pos.y = p.rest.y
          if (p.vel.y < -0.3) this.onLand?.(p, -p.vel.y)
          p.vel.y = p.vel.y < -1 ? -p.vel.y * 0.3 : 0 // one little bounce
          const friction = Math.exp(-dt * 5)
          p.vel.x *= friction
          p.vel.z *= friction
        }
        this.collide(p)
        this.settleRotation(p, dt)
        if (grounded && p.vel.y === 0 && Math.hypot(p.vel.x, p.vel.z) < 0.02) {
          p.state = 'rest'
          p.anchor.copy(pos)
        }
      } else if (p.state === 'home') {
        pos.lerp(p.rest, 1 - Math.exp(-dt * 4))
        this.settleRotation(p, dt)
        if (pos.distanceTo(p.rest) < 0.002) {
          pos.copy(p.rest)
          p.mesh.rotation.copy(p.restRot)
          p.anchor.copy(p.rest)
          p.vel.set(0, 0, 0)
          p.state = 'rest'
        }
      }
    }
  }

  private settleRotation(p: Prop, dt: number) {
    const k = 1 - Math.exp(-dt * 8)
    p.mesh.rotation.x += (p.restRot.x - p.mesh.rotation.x) * k
    p.mesh.rotation.z += (p.restRot.z - p.mesh.rotation.z) * k
  }

  // keep out of the PC, no further back than its middle, and within reach of it
  private collide(p: Prop) {
    const pos = p.mesh.position
    const o = this.obstacle

    // the invisible wall halfway back: silent, it isn't anything you can hit
    const wall = (o.min.z + o.max.z) / 2
    const behind = pos.z + p.offset.z + p.half.z - wall
    if (behind > 0) {
      pos.z -= behind
      p.vel.z = Math.min(0, p.vel.z)
    }

    // the PC itself is solid: push out along the shallower side, and knock
    const cx = pos.x + p.offset.x
    const cz = pos.z + p.offset.z
    const px = Math.min(cx + p.half.x - o.min.x, o.max.x - (cx - p.half.x))
    const pz = Math.min(cz + p.half.z - o.min.z, o.max.z - (cz - p.half.z))
    if (px > 0 && pz > 0) {
      const mid = o.getCenter(this.hit)
      const held = p.state === 'held'
      let speed: number
      if (px < pz) {
        speed = held ? Math.min(Math.abs(p.vel.x), Math.abs(this.aimVel.x)) : Math.abs(p.vel.x)
        pos.x += cx < mid.x ? -px : px
        p.vel.x = 0
      } else {
        speed = held ? Math.min(Math.abs(p.vel.z), Math.abs(this.aimVel.z)) : Math.abs(p.vel.z)
        pos.z += cz < mid.z ? -pz : pz
        p.vel.z = 0
      }
      if (this.time - p.lastTouch > KNOCK_GAP && speed > 0.6) this.onBump?.(p, speed)
      p.lastTouch = this.time
    }

    // and not too far away (silent too)
    const dx = pos.x + p.offset.x - this.center.x
    const dz = pos.z + p.offset.z - this.center.z
    const d = Math.hypot(dx, dz)
    if (d > BOUNDS) {
      pos.x -= (dx / d) * (d - BOUNDS)
      pos.z -= (dz / d) * (d - BOUNDS)
      p.vel.x = p.vel.z = 0
    }
  }
}

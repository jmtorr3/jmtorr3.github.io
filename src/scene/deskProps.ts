import * as THREE from 'three'

// The keyboard and mouse can be picked up and dropped around the desk. They stay
// where they land until the desktop is shut down, then glide back home.

// while something is held, the camera doesn't orbit (CameraRig checks this)
export const grabState = { active: false }

const LIFT = 0.45 // how high a held prop floats above the desk
const GRAVITY = 7
const BOUNDS = 2.4 // how far from the PC a prop can go

type State = 'rest' | 'held' | 'fall' | 'home'

export type Prop = {
  mesh: THREE.Object3D
  rest: THREE.Vector3 // where it started (and goes back to)
  restRot: THREE.Euler
  anchor: THREE.Vector3 // where it's sitting now (the desk mouse wiggles around this)
  vel: THREE.Vector3
  state: State
  offset: THREE.Vector3 // bounding-box center relative to the mesh position
  half: THREE.Vector3 // half the bounding-box size
}

export class DeskProps {
  readonly props: Prop[]
  private held: Prop | null = null
  private grabOffset = new THREE.Vector3()
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT)
  private hit = new THREE.Vector3()
  private target = new THREE.Vector3()
  private last = new THREE.Vector3()

  // obstacle: the PC's footprint, which props can't move into
  constructor(meshes: THREE.Object3D[], private obstacle: THREE.Box3, private center: THREE.Vector3) {
    this.props = meshes.map((mesh) => {
      const box = new THREE.Box3().setFromObject(mesh)
      return {
        mesh,
        rest: mesh.position.clone(),
        restRot: mesh.rotation.clone(),
        anchor: mesh.position.clone(),
        vel: new THREE.Vector3(),
        state: 'rest' as State,
        offset: box.getCenter(new THREE.Vector3()).sub(mesh.position),
        half: box.getSize(new THREE.Vector3()).multiplyScalar(0.5),
      }
    })
  }

  find(obj: THREE.Object3D) {
    return this.props.find((p) => p.mesh === obj) ?? null
  }

  get holding() {
    return this.held !== null
  }

  grab(prop: Prop, ray: THREE.Ray) {
    if (!ray.intersectPlane(this.plane, this.hit)) return
    this.grabOffset.copy(prop.mesh.position).sub(this.hit).setY(0)
    prop.state = 'held'
    this.held = prop
    grabState.active = true
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
    for (const p of this.props) {
      const pos = p.mesh.position
      if (p.state === 'held') {
        if (!ray.intersectPlane(this.plane, this.hit)) continue
        this.target.copy(this.hit).add(this.grabOffset).setY(p.rest.y + LIFT)
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

  // keep out of the PC and within reach of it (side to side only)
  private collide(p: Prop) {
    const pos = p.mesh.position
    const cx = pos.x + p.offset.x
    const cz = pos.z + p.offset.z
    const o = this.obstacle
    const px = Math.min(cx + p.half.x - o.min.x, o.max.x - (cx - p.half.x))
    const pz = Math.min(cz + p.half.z - o.min.z, o.max.z - (cz - p.half.z))
    if (px > 0 && pz > 0) {
      const mid = o.getCenter(this.hit)
      if (px < pz) {
        pos.x += cx < mid.x ? -px : px
        p.vel.x = 0
      } else {
        pos.z += cz < mid.z ? -pz : pz
        p.vel.z = 0
      }
    }
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

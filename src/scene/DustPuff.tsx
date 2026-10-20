import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

// Easter egg: a puff of dust blowing out of the fan on the back of the PC.
// Square pixel particles that drift out, slow down, rise a little and fade out
// with a picoCAD-style dither (no transparency, so the outline pass stays clean).

const N = 60

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aFade;
  attribute float aShade;
  uniform float pxScale;
  varying float vFade;
  varying float vShade;
  void main() {
    vFade = aFade;
    vShade = aShade;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aFade <= 0.0 ? 0.0 : aSize * pxScale / -mv.z;
  }
`

const fragmentShader = /* glsl */ `
  varying float vFade;
  varying float vShade;
  void main() {
    // 2x2 ordered dither in 2px blocks: fading particles lose chunks instead of
    // going see-through (1px dither turns into color fringes under the aberration)
    vec2 p = mod(floor(gl_FragCoord.xy / 2.0), 2.0);
    float threshold = (p.x * 2.0 + p.y * 3.0 - 2.0 * p.x * p.y + 0.5) / 4.0;
    if (vFade < threshold) discard;
    // alpha 0.5: drawn, but the post pass doesn't outline it (see PicoPostFX)
    gl_FragColor = vec4(vec3(0.62, 0.57, 0.48) * vShade, 0.5);
  }
`

export function DustPuff() {
  const fart = useStore((s) => s.fart)

  const sim = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(N * 3)
    const size = new Float32Array(N)
    const fade = new Float32Array(N)
    const shade = new Float32Array(N)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1))
    geo.setAttribute('aShade', new THREE.BufferAttribute(shade, 1))
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      // the scene renders into a 200px-tall target (PicoPostFX), fov 40
      uniforms: { pxScale: { value: 200 / (2 * Math.tan(THREE.MathUtils.degToRad(20))) } },
    })
    const points = new THREE.Points(geo, material)
    points.frustumCulled = false
    const vel = new Float32Array(N * 3)
    const life = new Float32Array(N).fill(1)
    const maxLife = new Float32Array(N).fill(1)
    const baseSize = new Float32Array(N)
    return { geo, pos, size, fade, shade, vel, life, maxLife, baseSize, material, points }
  }, [])

  useEffect(() => {
    if (!fart) return
    const [ax, ay, az] = fart.at
    const dir = new THREE.Vector3(...fart.dir).normalize()
    for (let i = 0; i < N; i++) {
      // out of the fan in a cone, with a bit of upward drift
      const spread = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.5, Math.random() - 0.5).multiplyScalar(0.8)
      const v = dir.clone().multiplyScalar(0.6 + Math.random() * 1.2).add(spread)
      sim.pos.set([ax + (Math.random() - 0.5) * 0.08, ay + (Math.random() - 0.5) * 0.08, az + (Math.random() - 0.5) * 0.08], i * 3)
      sim.vel.set([v.x, v.y + 0.55, v.z], i * 3)
      sim.life[i] = -Math.random() * 0.25 // stagger: the puff keeps coming for a moment
      sim.maxLife[i] = 0.9 + Math.random() * 1.1
      sim.baseSize[i] = 0.05 + Math.random() * 0.06
      sim.shade[i] = 0.75 + Math.random() * 0.35
    }
    sim.geo.attributes.aShade.needsUpdate = true
  }, [fart, sim])

  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05)
    const drag = Math.pow(0.12, dt)
    let alive = false
    for (let i = 0; i < N; i++) {
      sim.life[i] += dt
      const t = sim.life[i]
      if (t < 0 || t > sim.maxLife[i]) {
        sim.fade[i] = 0
        if (t < 0) alive = true
        continue
      }
      alive = true
      for (let k = 0; k < 3; k++) sim.pos[i * 3 + k] += sim.vel[i * 3 + k] * dt
      sim.vel[i * 3] *= drag
      sim.vel[i * 3 + 2] *= drag
      sim.vel[i * 3 + 1] = sim.vel[i * 3 + 1] * drag + 0.5 * dt // dust billows up
      const k = t / sim.maxLife[i]
      sim.fade[i] = 1 - k
      sim.size[i] = sim.baseSize[i] * (1 + k * 2.5) // puffs spread out
    }
    if (!alive) return
    sim.geo.attributes.position.needsUpdate = true
    sim.geo.attributes.aFade.needsUpdate = true
    sim.geo.attributes.aSize.needsUpdate = true
  })

  return <primitive object={sim.points} />
}

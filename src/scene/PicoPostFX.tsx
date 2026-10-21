import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

// Renders the scene into a tiny target and blows it up with nearest filtering,
// then applies picoCAD2's export extras: 1px outline (project_main.lua
// outline_shader) and horizontal chromatic aberration (chromatic_shader).

const LOW_RES_HEIGHT = 200
// The boot log on Slumpy's screen is a 3×5 font: at 200px it drops pixels, and a
// tall phone gets only ~90px across. While it's on (it's all monitor by then
// anyway), the resolution goes up: at least BOOT_SCALE×, and on a tall screen
// until the width is at least BOOT_MIN_WIDTH times the height.
const BOOT_SCALE = 1.6
const BOOT_MIN_WIDTH = 1.6

const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 texSize;
  uniform float aberration;   // in low-res pixels
  uniform vec3 outlineColor;
  uniform float rainbow;      // 1 while hovered: the outline cycles colors
  uniform float time;
  uniform vec3 bgTop;
  uniform vec3 bgBottom;
  varying vec2 vUv;

  vec4 sampleScene(vec2 uv) {
    vec2 o = vec2(aberration / texSize.x, 0.0);
    vec4 c = texture2D(tDiffuse, uv);
    c.r = texture2D(tDiffuse, uv + o).r;
    c.b = texture2D(tDiffuse, uv - o).b;
    return c;
  }

  void main() {
    vec2 px = floor(vUv * texSize);
    vec2 uv = (px + 0.5) / texSize;
    vec4 c = sampleScene(uv);
    if (c.a > 0.0) { gl_FragColor = vec4(c.rgb, 1.0); return; }

    vec2 t = 1.0 / texSize;
    // only solid geometry (alpha 1) gets outlined; effects like the dust puff
    // write alpha 0.5 so they're drawn but leave no outline
    float hit = step(0.75, texture2D(tDiffuse, uv + vec2(t.x, 0.0)).a)
              + step(0.75, texture2D(tDiffuse, uv - vec2(t.x, 0.0)).a)
              + step(0.75, texture2D(tDiffuse, uv + vec2(0.0, t.y)).a)
              + step(0.75, texture2D(tDiffuse, uv - vec2(0.0, t.y)).a);
    if (hit > 0.0) {
      vec3 col = outlineColor;
      if (rainbow > 0.5) {
        // PICO-8 rainbow in diagonal bands that march along the outline
        float i = mod(floor((px.x + px.y) / 4.0 - time * 12.0), 7.0);
        col = i < 1.0 ? vec3(1.0, 0.0, 0.302)       // red
            : i < 2.0 ? vec3(1.0, 0.639, 0.0)       // orange
            : i < 3.0 ? vec3(1.0, 0.925, 0.153)     // yellow
            : i < 4.0 ? vec3(0.0, 0.894, 0.212)     // green
            : i < 5.0 ? vec3(0.161, 0.678, 1.0)     // blue
            : i < 6.0 ? vec3(0.514, 0.463, 0.612)   // lavender
            :           vec3(1.0, 0.467, 0.659);    // pink
      }
      gl_FragColor = vec4(col, 1.0);
      return;
    }

    // background: 4 bands with a checker dither between each, like the shading
    float g = uv.y * 4.0;
    float band = floor(g);
    bool checker = mod(px.x + px.y, 2.0) < 1.0;
    if (fract(g) > 0.5 && checker) band += 1.0;
    gl_FragColor = vec4(mix(bgBottom, bgTop, clamp(band / 4.0, 0.0, 1.0)), 1.0);
  }
`

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export function PicoPostFX({ hovered }: { hovered: boolean }) {
  const { gl, scene, camera, size } = useThree()

  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
        depthBuffer: true,
      }),
    [],
  )

  const post = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: target.texture },
        texSize: { value: new THREE.Vector2(1, 1) },
        aberration: { value: 0.5 },
        outlineColor: { value: new THREE.Color('#000000') },
        rainbow: { value: 0 },
        time: { value: 0 },
        bgTop: { value: new THREE.Color('#1d2b53') },
        bgBottom: { value: new THREE.Color('#0b0f22') },
      },
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    const s = new THREE.Scene()
    s.add(quad)
    return { scene: s, material, camera: new THREE.Camera() }
  }, [target])

  const booting = useStore((s) => s.leaning) // (up close to the boot log)
  useEffect(() => {
    const h = Math.round(LOW_RES_HEIGHT * (booting ? Math.max(BOOT_SCALE, (BOOT_MIN_WIDTH * size.height) / size.width) : 1))
    const w = Math.max(1, Math.round((h * size.width) / size.height))
    target.setSize(w, h)
    post.material.uniforms.texSize.value.set(w, h)
  }, [size, target, post, booting])

  useEffect(() => {
    post.material.uniforms.rainbow.value = hovered ? 1 : 0
  }, [hovered, post])

  useEffect(() => () => target.dispose(), [target])

  useFrame((state) => {
    post.material.uniforms.time.value = state.clock.elapsedTime
    gl.setRenderTarget(target)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.render(post.scene, post.camera)
  }, 1)

  return null
}

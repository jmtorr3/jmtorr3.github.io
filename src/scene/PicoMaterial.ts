import * as THREE from 'three'

// Port of picoCAD2's face shading (src/3d/scene.lua): a camera-relative light,
// one light factor per face, quantized into 4 bands. picoCAD swaps palette
// indices for the dark bands; we keep the model's own colors and darken instead.
//   lf < 0.40  -> darker
//   lf < 0.56  -> dark
//   lf < 0.75  -> checkerboard of dark / regular (skrovet DITHER shader)
//   else       -> regular

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 lightDir;   // view space, direction the light travels
  uniform float ambient;
  uniform float dark;
  uniform float darker;
  uniform float texSize;
  uniform vec3 leds;       // brightness of the case's red / green / blue lights, 0..1
  varying vec2 vUv;
  varying vec3 vViewPos;

  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.05) discard;

    // the three front-panel lights are single texels in row 47 of the atlas;
    // lit ones glow (unshaded), unlit ones go dark
    vec2 texel = floor(vUv * texSize);
    if (texel.y == 47.0 && (texel.x == 46.0 || texel.x == 48.0 || texel.x == 50.0)) {
      float k = texel.x == 46.0 ? leds.r : texel.x == 48.0 ? leds.g : leds.b;
      vec3 lit = texel.x == 46.0 ? vec3(1.0, 0.16, 0.16) : texel.x == 48.0 ? vec3(0.3, 1.0, 0.4) : vec3(0.3, 0.65, 1.0);
      gl_FragColor = vec4(mix(tex.rgb * 0.8, lit, k), 1.0);
      return;
    }

    // flat face normal straight from screen-space derivatives
    vec3 n = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));

    float lf = -dot(n, lightDir);
    lf = min(1.0, max(ambient, 1.0 - (1.0 - lf) * (1.0 - lf)));

    bool checker = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0;

    float shade = 1.0;
    if (lf < 0.4) shade = darker;
    else if (lf < 0.56) shade = dark;
    else if (lf < 0.75) shade = checker ? 1.0 : dark;

    gl_FragColor = vec4(tex.rgb * shade, 1.0);
  }
`

export function makePicoMaterial(map: THREE.Texture | null) {
  if (map) {
    map.magFilter = THREE.NearestFilter
    map.minFilter = THREE.NearestFilter
    map.generateMipmaps = false
    map.colorSpace = THREE.NoColorSpace // keep texel values exact, picoCAD style
    map.needsUpdate = true
  }
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      map: { value: map },
      lightDir: { value: new THREE.Vector3(0, -0.3, -1).normalize() },
      ambient: { value: 0.15 },
      dark: { value: 0.62 },
      darker: { value: 0.38 },
      texSize: { value: (map?.image as { width?: number } | undefined)?.width ?? 128 },
      leds: { value: new THREE.Vector3(1, 1, 1) },
    },
  })
}

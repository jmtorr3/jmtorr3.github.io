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
  varying vec2 vUv;
  varying vec3 vViewPos;

  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.05) discard;

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
    },
  })
}

import * as THREE from 'three'

// Unlit material for the monitor's screen panel: it glows instead of taking the
// picoCAD light bands. The panel's atlas UVs don't cover a whole image, so the
// face texture is mapped from world position across the panel's front instead.

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 boundsMin;
  uniform vec2 boundsSize;
  varying vec3 vWorld;
  void main() {
    // the PC faces -z, so the viewer's right is world -x
    vec2 uv = vec2(1.0 - (vWorld.x - boundsMin.x) / boundsSize.x, (vWorld.y - boundsMin.y) / boundsSize.y);
    gl_FragColor = vec4(texture2D(map, clamp(uv, 0.0, 1.0)).rgb, 1.0);
  }
`

export function makeScreenMaterial(map: THREE.Texture, bounds: THREE.Box3) {
  const size = bounds.getSize(new THREE.Vector3())
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      map: { value: map },
      boundsMin: { value: new THREE.Vector2(bounds.min.x, bounds.min.y) },
      boundsSize: { value: new THREE.Vector2(size.x, size.y) },
    },
  })
}

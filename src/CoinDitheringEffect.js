import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

// Dithering shader constants
const DitheringShapes = {
  simplex: 1,
  warp: 2,
  dots: 3,
  wave: 4,
  ripple: 5,
  swirl: 6,
  sphere: 7
}

const DitheringTypes = {
  "random": 1,
  "2x2": 2,
  "4x4": 3,
  "8x8": 4
}

// Vertex shader - simple passthrough
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Vertex shader for 3D model with lighting
const modelVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader for 3D model with dithering (reuses background shader logic)
const modelFragmentShader = `
  precision mediump float;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  
  uniform vec3 u_lightPosition;
  uniform vec3 u_lightColor;
  uniform float u_lightIntensity;
  uniform vec3 u_ambientLight;
  uniform vec2 u_resolution;
  uniform float u_pxSize;
  uniform vec4 u_colorBack;
  uniform vec4 u_colorFront;
  uniform float u_roughness;
  
  // 8x8 Bayer matrix (same as background)
  const int bayer8x8[64] = int[64](
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  );
  
  // Random noise function for surface roughness
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }
  
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  float getBayerValue(vec2 uv, int size) {
    ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
    int index = pos.y * size + pos.x;
    return float(bayer8x8[index]) / 64.0;
  }
  
  void main() {
    // Calculate lighting
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(u_lightPosition - vPosition);
    
    // Add static surface roughness to normal
    vec2 roughnessUV = vUv * 80.0;  // Scale for roughness detail
    float roughnessNoise = noise(roughnessUV) * u_roughness;
    
    // Perturb normal with roughness
    normal.x += roughnessNoise * 0.15;
    normal.y += roughnessNoise * 0.15;
    normal = normalize(normal);
    
    // Simple diffuse lighting
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Combine lighting (simplified)
    float lightValue = u_ambientLight.r + (u_lightIntensity * diff);
    
    // Use the same dithering logic as background
    float pxSize = u_pxSize;
    vec2 pxSizeUV = gl_FragCoord.xy - 0.5 * u_resolution;
    pxSizeUV /= pxSize;
    
    // Get dithering threshold
    float dithering = getBayerValue(pxSizeUV, 8);
    dithering -= 1.2;
    
    // Apply dithering to lighting value
    float res = step(0.5, lightValue + dithering);
    
    // Mix colors like background shader
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;
    
    vec3 color = fgColor * res;
    float opacity = fgOpacity * res;
    
    color += bgColor * (1.0 - opacity);
    opacity += bgOpacity * (1.0 - opacity);
    
    gl_FragColor = vec4(color, opacity);
  }
`

// Fragment shader - dithering effect (WebGL1 compatible)
const ditheringFragmentShader = `precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;

// Sizing uniforms
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform float u_pxSize;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_type;

// PI constants
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

// Hash functions
float hash11(float p) {
  p = fract(p * 0.3183099) + 0.1;
  p *= p + 19.19;
  return fract(p * p);
}

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// Simplex noise
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float getSimplexNoise(vec2 uv, float t) {
  float noise = .01 * snoise(uv - vec2(0., -.8 * t));
  noise += .5 * snoise(2. * uv + vec2(0., -.32 * t));
  return noise;
}

// Bayer matrices
const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}

void main() {
  float t = .5 * u_time;

  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec2 shapeUV = normalizedUV;

  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 boxSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  
  if (u_shape > 3.5) {
    vec2 objectBoxSize = vec2(0.);
    // fit = none
    objectBoxSize.x = min(boxSize.x, boxSize.y);
    if (u_fit == 1.) { // fit = contain
      objectBoxSize.x = min(u_resolution.x, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      objectBoxSize.x = max(u_resolution.x, u_resolution.y);
    }
    objectBoxSize.y = objectBoxSize.x;
    vec2 objectWorldScale = u_resolution.xy / objectBoxSize;

    shapeUV *= objectWorldScale;
    shapeUV += boxOrigin * (objectWorldScale - 1.);
    shapeUV += vec2(-u_offsetX, u_offsetY);
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
  } else {
    vec2 patternBoxSize = vec2(0.);
    // fit = none
    patternBoxSize.x = patternBoxRatio * min(boxSize.x / patternBoxRatio, boxSize.y);
    float patternWorldNoFitBoxWidth = patternBoxSize.x;
    if (u_fit == 1.) { // fit = contain
      patternBoxSize.x = patternBoxRatio * min(u_resolution.x / patternBoxRatio, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      patternBoxSize.x = patternBoxRatio * max(u_resolution.x / patternBoxRatio, u_resolution.y);
    }
    patternBoxSize.y = patternBoxSize.x / patternBoxRatio;
    vec2 patternWorldScale = u_resolution.xy / patternBoxSize;

    shapeUV += vec2(-u_offsetX, u_offsetY) / patternWorldScale;
    shapeUV += boxOrigin;
    shapeUV -= boxOrigin / patternWorldScale;
    shapeUV *= u_resolution.xy;
    shapeUV /= u_pixelRatio;
    if (u_fit > 0.) {
      shapeUV *= (patternWorldNoFitBoxWidth / patternBoxSize.x);
    }
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
    shapeUV += boxOrigin / patternWorldScale;
    shapeUV -= boxOrigin;
    shapeUV += .5;
  }

  float shape = 0.;
  if (u_shape < 1.5) {
    // Simplex noise
    shapeUV *= .001;
    shape = 0.5 + 0.5 * getSimplexNoise(shapeUV, t);
    shape = smoothstep(0.3, 0.9, shape);
    
    // Apply gradient mask to reduce effect at top
    float gradientMask = normalizedUV.y;
    shape = mix(0.02, shape, -gradientMask);
  } else if (u_shape < 2.5) {
    // Warp
    shapeUV *= .003;
    for (float i = 1.0; i < 6.0; i++) {
      shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
      shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
    }
    shape = .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
    shape = smoothstep(0.02, 1., shape);
  } else if (u_shape < 3.5) {
    // Dots
    shapeUV *= .05;
    float stripeIdx = floor(2. * shapeUV.x / TWO_PI);
    float rand = hash11(stripeIdx * 10.);
    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
    shape = sin(shapeUV.x) * cos(shapeUV.y - 5. * rand * t);
    shape = pow(abs(shape), 6.);
  } else if (u_shape < 4.5) {
    // Sine wave
    shapeUV *= 4.;
    float wave = cos(.5 * shapeUV.x - 2. * t) * sin(1.5 * shapeUV.x + t) * (.75 + .25 * cos(3. * t));
    shape = 1. - smoothstep(-1., 1., shapeUV.y + wave);
  } else if (u_shape < 5.5) {
    // Ripple
    float dist = length(shapeUV);
    float waves = sin(pow(dist, 1.7) * 7. - 3. * t) * .5 + .5;
    shape = waves;
  } else if (u_shape < 6.5) {
    // Swirl
    float l = length(shapeUV);
    float angle = 6. * atan(shapeUV.y, shapeUV.x) + 4. * t;
    float twist = 1.2;
    float offset = 1. / pow(max(l, 1e-6), twist) + angle / TWO_PI;
    float mid = smoothstep(0., 1., pow(l, twist));
    shape = mix(0., fract(offset), mid);
  } else {
    // Sphere
    shapeUV *= 2.;
    float d = 1. - pow(length(shapeUV), 2.);
    vec3 pos = vec3(shapeUV, sqrt(max(0., d)));
    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
    shape = .5 + .5 * dot(lightPos, pos);
    shape *= step(0., d);
  }

  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), shape);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  dithering -= .5;
  float res = step(.5, shape + dithering);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  gl_FragColor = vec4(color, opacity);
}
`

// Fragment shader for coin with dithering effect
const coinFragmentShader = `precision mediump float;

varying vec2 vUv;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_texture;

uniform float u_pxSize;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_type;

// PI constants
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

// Hash functions
float hash11(float p) {
  p = fract(p * 0.3183099) + 0.1;
  p *= p + 19.19;
  return fract(p * p);
}

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// Simplex noise
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float getSimplexNoise(vec2 uv, float t) {
  float noise = .01 * snoise(uv - vec2(0., -.8 * t));
  noise += .5 * snoise(2. * uv + vec2(0., -.32 * t));
  return noise;
}

// Bayer matrices
const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}

void main() {
  float t = .5 * u_time;

  // Sample the coin texture first
  vec4 texColor = texture2D(u_texture, vUv);
  
  // Create the SAME simplex noise pattern as the background
  vec2 shapeUV = vUv * 0.001; // Same scale as background
  float shape = 0.5 + 0.5 * getSimplexNoise(shapeUV, t);
  shape = smoothstep(0.3, 0.9, shape);
  
  // Create dithering pattern
  vec2 screenUV = gl_FragCoord.xy / u_resolution;
  vec2 ditheringUV = screenUV * 200.0;
  
  // Add organic noise for natural look
  vec2 noiseOffset = vec2(
    snoise(vUv * 15.0 + t * 0.2) * 0.1,
    snoise(vUv * 15.0 + 100.0 + t * 0.2) * 0.1
  );
  ditheringUV += noiseOffset;
  
  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringUV), shape);
    } break;
    case 2:
    dithering = getBayerValue(ditheringUV, 2);
    break;
    case 3:
    dithering = getBayerValue(ditheringUV, 4);
    break;
    default :
    dithering = getBayerValue(ditheringUV, 8);
    break;
  }

  // Apply dithering with shape
  dithering -= .5;
  float res = step(.5, shape + dithering);
  
  // Apply dithering to the coin
  vec3 color = texColor.rgb;
  float opacity = texColor.a * res;

  gl_FragColor = vec4(color, opacity);
}
`

export class CoinDitheringEffect {
  constructor(container, imageSrc, width, height) {
    this.container = container
    this.width = width
    this.height = height
    this.imageSrc = imageSrc
    
    // Shader parameters
    this.colorFront = new THREE.Vector4(1.0, 1.0, 1.0, 1.0) // #0F0F0F
    this.colorBack = new THREE.Vector4(0.06, 0.06, 0.06, 1.0) // #FFFFFF
    this.shape = DitheringShapes.simplex
    this.type = DitheringTypes['8x8']
    this.bgPxSize = 1  // Dot size for background
    this.modelPxSize = 2.5  // Dot size for 3D model
    
    // Animation parameters
    this.time = 0
    
    this.init()
  }
  
  init() {
    // Create scene
    this.scene = new THREE.Scene()
    
    // Create camera with larger frustum to see the model
    const aspect = this.width / this.height
    const frustumSize = 2
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    )
    this.camera.position.z = 5
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      logarithmicDepthBuffer: true  // Better depth precision
    })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)
    
    // Enable shadows in renderer
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    
    // Ensure proper depth testing
    this.renderer.sortObjects = true
    
    // Create material with shaders for background
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: ditheringFragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(this.width, this.height) },
        u_pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        u_pxSize: { value: this.bgPxSize },
        u_colorBack: { value: this.colorBack },
        u_colorFront: { value: this.colorFront },
        u_shape: { value: this.shape },
        u_type: { value: this.type },
        // Sizing uniforms
        u_originX: { value: 0.5 },
        u_originY: { value: 0.5 },
        u_worldWidth: { value: 0 },
        u_worldHeight: { value: 0 },
        u_scale: { value: 1 },
        u_offsetX: { value: 0 },
        u_offsetY: { value: 0 },
        u_rotation: { value: 0 },
        u_fit: { value: 0 }
      },
      transparent: true
    })
    
    // Create plane geometry for background - larger to fill the view
    const geometry = new THREE.PlaneGeometry(2 * aspect, 2)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.position.z = 0  // Background plane at z=0
    this.scene.add(this.mesh)
    
    // Add lights to the scene
    this.setupLights()
    
    // Load FBX model
    this.loadFBXModel()
    
    // Start animation
    this.animate()
  }
  
  setupLights() {
    // Create spotlight for upper part illumination
    this.spotLight = new THREE.SpotLight(0xffffff, 4)
    this.spotLight.position.set(0, 2, 4)  // Higher and centered above the model
    this.spotLight.target.position.set(0, 2, 6)  // Point at the model's new position
    this.scene.add(this.spotLight.target)
    this.spotLight.angle = Math.PI / 3
    this.spotLight.penumbra = 1.5
    this.spotLight.decay = 1
    this.spotLight.distance = 5
    this.spotLight.castShadow = true
    this.spotLight.shadow.mapSize.width = 1024
    this.spotLight.shadow.mapSize.height = 1024
    this.scene.add(this.spotLight)
    
    // Add ambient light for subtle base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)  // Brighter ambient
    this.scene.add(ambientLight)
    
    // Add directional light from top to enhance the spotlight effect
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)  // Brighter directional
    directionalLight.position.set(0, 4, 2)  // From above
    directionalLight.castShadow = true
    this.scene.add(directionalLight)
  }
  
  loadFBXModel() {
    const loader = new FBXLoader()
    
    loader.load(
      '/ETH.fbx',
      (fbx) => {
        // Store the model
        this.fbxModel = fbx
        
        // Center the model
        const box = new THREE.Box3().setFromObject(fbx)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        console.log('Model bounds:', {
          center: center,
          size: size,
          min: box.min,
          max: box.max
        })
        
        fbx.position.sub(center)
        
        // Scale the model to fit the scene - FBX models are often huge
        const maxDim = Math.max(size.x, size.y, size.z)
        const targetSize = 1.5  // Target size in world units
        const scale = targetSize / maxDim
        fbx.scale.setScalar(scale)
        
        
        // Position the model in front of the background plane
        fbx.position.set(0.66, -0.66, 3)  // Further from background to avoid z-fighting
        
        // Rotate to show the front side better
        fbx.rotation.x = Math.PI * 1.35  // Tilt forward to see face details
        fbx.rotation.y = Math.PI * 1.1  // Tilt forward to see face details
        fbx.rotation.z = Math.PI * .2  // Rotate to show front at better angle
        
        console.log('Model final position:', fbx.position)
        console.log('Model final scale:', fbx.scale)
        
        // Apply material and enable shadows for the model
        let meshCount = 0
        fbx.traverse((child) => {
          if (child.isMesh) {
            meshCount++
            
            // Check if original material has a texture
            const hasTexture = child.material?.map
            
            // Create custom shader material with dithering (using background shader logic)
            child.material = new THREE.ShaderMaterial({
              vertexShader: modelVertexShader,
              fragmentShader: modelFragmentShader,
              uniforms: {
                u_lightPosition: { value: new THREE.Vector3(-1, 3, 5) },
                u_lightColor: { value: new THREE.Color(0xffffff) },
                u_lightIntensity: { value: 0.43 },
                u_ambientLight: { value: new THREE.Color(0.4, 0.4, 0.4) },
                u_resolution: { value: new THREE.Vector2(this.width, this.height) },
                u_pxSize: { value: this.modelPxSize },  // Independent model dot size
                u_colorBack: { value: this.colorBack },  // Same as background
                u_colorFront: { value: this.colorFront },  // Same as background
                u_roughness: { value: 0.5 }  // Static surface roughness amount (0-1)
              },
              side: THREE.DoubleSide,
              transparent: true
            })
            
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        
        // Add to scene
        this.scene.add(fbx)
      },
      (xhr) => {
        console.log(`${(xhr.loaded / xhr.total * 100)}% loaded`)
      },
      (error) => {
        console.error('Error loading FBX model:', error)
      }
    )
  }
  
  animate() {
    requestAnimationFrame(() => this.animate())
    
    // Update time uniform
    this.time = performance.now() * 0.0001
    this.material.uniforms.u_time.value = this.time
    
    // Animate the spotlight slightly for dynamic effect
    if (this.spotLight) {
      const lightX = Math.sin(this.time * 0.5) * 0.1
      const lightY = 0.5 + Math.cos(this.time * 0.3) * 0.05
      this.spotLight.position.set(lightX, lightY, 0.5)
    }
    
    // Rotate the FBX model if loaded
    if (this.fbxModel) {
      // Oscillate between -25 and +25 degrees
      const maxRotation = 25 * Math.PI / 180  // 25 degrees in radians
      const rotationAngle = Math.sin(this.time * 1) * maxRotation
      this.fbxModel.rotation.z = rotationAngle
    }
    
    this.renderer.render(this.scene, this.camera)
  }
  
  dispose() {
    this.renderer.dispose()
    this.material.dispose()
  }
}

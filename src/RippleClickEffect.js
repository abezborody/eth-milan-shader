import * as THREE from 'three'

// Vertex shader - simple passthrough
const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`

// Fragment shader - pixel blast effect on click (supports 10 clicks like CoinPixelBlastEffect)
const fragmentShader = `
  precision highp float;
  
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uPixelSize;
  uniform float uScale;
  uniform float uDensity;
  uniform float uPixelJitter;
  uniform int uEnableRipples;
  uniform float uRippleSpeed;
  uniform float uRippleThickness;
  uniform float uRippleIntensity;
  uniform int uShapeType;
  
  const int SHAPE_SQUARE   = 0;
  const int SHAPE_CIRCLE   = 1;
  const int SHAPE_TRIANGLE = 2;
  const int SHAPE_DIAMOND  = 3;
  
  const int MAX_CLICKS = 10;
  
  uniform vec2 uClickPos[MAX_CLICKS];
  uniform float uClickTimes[MAX_CLICKS];
  
  // Bayer dithering functions from CoinPixelBlastEffect
  float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2. + a.y * a.y * .75);
  }
  #define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
  #define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))
  
  #define FBM_OCTAVES 5
  #define FBM_LACUNARITY 1.25
  #define FBM_GAIN 1.0
  
  float hash11(float n) { 
    return fract(sin(n)*43758.5453); 
  }
  
  float vnoise(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
    float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
    float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
    float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
    float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
    float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
    float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
    float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
    vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
    float x00 = mix(n000, n100, w.x);
    float x10 = mix(n010, n110, w.x);
    float x01 = mix(n001, n101, w.x);
    float x11 = mix(n011, n111, w.x);
    float y0  = mix(x00, x10, w.y);
    float y1  = mix(x01, x11, w.y);
    return mix(y0, y1, w.z) * 2.0 - 1.0;
  }
  
  float fbm2(vec2 uv, float t) {
    vec3 p = vec3(uv * uScale, t);
    float amp = 1.0;
    float freq = 1.0;
    float sum = 1.0;
    for (int i = 0; i < FBM_OCTAVES; ++i) {
      sum  += amp * vnoise(p * freq);
      freq *= FBM_LACUNARITY;
      amp  *= FBM_GAIN;
    }
    return sum * 0.5 + 0.5;
  }
  
  float maskCircle(vec2 p, float cov) {
    float r = sqrt(cov) * .25;
    float d = length(p - 0.5) - r;
    float aa = 0.5 * fwidth(d);
    return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
  }
  
  float maskTriangle(vec2 p, vec2 id, float cov) {
    bool flip = mod(id.x + id.y, 2.0) > 0.5;
    if (flip) p.x = 1.0 - p.x;
    float r = sqrt(cov);
    float d  = p.y - r*(1.0 - p.x);
    float aa = fwidth(d);
    return cov * clamp(0.5 - d/aa, 0.0, 1.0);
  }
  
  float maskDiamond(vec2 p, float cov) {
    float r = sqrt(cov) * 0.564;
    return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
  }
  
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    
    // Sample the original texture to get letter luminance
    vec4 texColor = texture2D(uTexture, uv);
    float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    
    float pixelSize = uPixelSize;
    vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
    float aspectRatio = uResolution.x / uResolution.y;
    
    vec2 pixelId = floor(fragCoord / pixelSize);
    vec2 pixelUV = fract(fragCoord / pixelSize);
    
    float cellPixelSize = 8.0 * pixelSize;
    vec2 cellId = floor(fragCoord / cellPixelSize);
    vec2 cellCoord = cellId * cellPixelSize;
    vec2 cellUV = cellCoord / uResolution * vec2(aspectRatio, 1.0);
    
    float base = fbm2(cellUV, uTime * 0.05);
    base = base * 0.5 - 0.65;
    
    float feed = base + (uDensity - 0.5) * 0.3;
    
    float speed = uRippleSpeed;
    float thickness = uRippleThickness;
    const float dampT = 1.0;
    const float dampR = 10.0;
    
    if (uEnableRipples == 1) {
      for (int i = 0; i < MAX_CLICKS; ++i) {
        vec2 pos = uClickPos[i];
        if (pos.x < 0.0) continue;
        float cellPixelSize = 8.0 * pixelSize;
        vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
        float t = max(uTime - uClickTimes[i], 0.0);
        float r = distance(cellUV, cuv);
        float waveR = speed * t;
        float ring  = exp(-pow((r - waveR) / thickness, 2.0));
        float atten = exp(-dampT * t) * exp(-dampR * r);
        feed = max(feed, ring * atten * uRippleIntensity);
      }
    }
    
    float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
    float bw = step(0.5, feed + bayer);
    
    float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
    float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
    float coverage = bw * jitterScale;
    float M;
    if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle(pixelUV, coverage);
    else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
    else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
    else                                   M = coverage;
    
    // White dots on letters (high luma), black dots outside (low luma)
    vec3 color = vec3(luma);
    
    gl_FragColor = vec4(color, M * texColor.a);
  }
`

const SHAPE_MAP = {
  square: 0,
  circle: 1,
  triangle: 2,
  diamond: 3
}

const MAX_CLICKS = 10

export class RippleClickEffect {
  constructor(container, imageSrc, width, height) {
    this.container = container
    this.width = width
    this.height = height
    this.disposed = false
    
    this.config = {
      variant: 'circle',
      pixelSize: 6,
      patternScale: 2,
      patternDensity: 1,
      pixelSizeJitter: 0,
      enableRipples: true,
      rippleIntensityScale: 1,
      rippleThickness: 0.1,
      rippleSpeed: 0.4,
      speed: 0.5
    }
    
    this.init(imageSrc)
  }
  
  async init(imageSrc) {
    this.scene = new THREE.Scene()
    
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10)
    this.camera.position.z = 1
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)
    
    const texture = await this.loadSVGAsTexture(imageSrc)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    
    const clickPositions = []
    const clickTimes = []
    for (let i = 0; i < MAX_CLICKS; i++) {
      clickPositions.push(new THREE.Vector2(-1, -1))
      clickTimes.push(0)
    }
    
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uResolution: { value: new THREE.Vector2(
          this.renderer.domElement.width,
          this.renderer.domElement.height
        )},
        uTime: { value: 0 },
        uClickPos: { value: clickPositions },
        uClickTimes: { value: new Float32Array(clickTimes) },
        uShapeType: { value: SHAPE_MAP[this.config.variant] ?? 0 },
        uPixelSize: { value: this.config.pixelSize * this.renderer.getPixelRatio() },
        uScale: { value: this.config.patternScale },
        uDensity: { value: this.config.patternDensity },
        uPixelJitter: { value: this.config.pixelSizeJitter },
        uEnableRipples: { value: this.config.enableRipples ? 1 : 0 },
        uRippleSpeed: { value: this.config.rippleSpeed },
        uRippleThickness: { value: this.config.rippleThickness },
        uRippleIntensity: { value: this.config.rippleIntensityScale }
      },
      transparent: true
    })
    
    const geometry = new THREE.PlaneGeometry(1, 1)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
    
    this.clock = new THREE.Clock()
    this.clickIndex = 0
    
    this.addEventListeners()
    this.animate()
  }
  
  loadSVGAsTexture(src) {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = this.width
        canvas.height = this.height
        const ctx = canvas.getContext('2d')
        
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        ctx.drawImage(img, 0, 0, this.width, this.height)
        
        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true
        resolve(texture)
      }
      img.src = src
    })
  }
  
  addEventListeners() {
    const canvas = this.renderer.domElement
    
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const fx = (e.clientX - rect.left) * scaleX
      const fy = (rect.height - (e.clientY - rect.top)) * scaleY
      
      const uniforms = this.material.uniforms
      uniforms.uClickPos.value[this.clickIndex].set(fx, fy)
      uniforms.uClickTimes.value[this.clickIndex] = uniforms.uTime.value
      this.clickIndex = (this.clickIndex + 1) % MAX_CLICKS
    })
    
    canvas.style.cursor = 'pointer'
  }
  
  animate() {
    if (this.disposed) return
    
    requestAnimationFrame(() => this.animate())
    
    const elapsed = this.clock.getElapsedTime() * this.config.speed
    this.material.uniforms.uTime.value = elapsed
    
    this.renderer.render(this.scene, this.camera)
  }
  
  dispose() {
    this.disposed = true
    
    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.material.dispose()
    }
    
    if (this.renderer) {
      this.renderer.dispose()
      if (this.renderer.domElement.parentElement === this.container) {
        this.container.removeChild(this.renderer.domElement)
      }
    }
    
    if (this.scene) this.scene.clear()
  }
}

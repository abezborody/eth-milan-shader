import * as THREE from 'three'

// Vertex shader - simple passthrough
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader - ripple click triggers inverted ASCII scramble effect over clean SVG
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform sampler2D uAsciiTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uAspect;
  uniform float uCharSize;
  uniform int uCharCount;
  
  // Click ripple uniforms - 3 ripples
  uniform vec2 uClickPos0;
  uniform float uClickTime0;
  uniform vec2 uClickPos1;
  uniform float uClickTime1;
  uniform vec2 uClickPos2;
  uniform float uClickTime2;
  
  varying vec2 vUv;
  
  // Pseudo-random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Calculate ripple intensity
  float calcRipple(vec2 uv, vec2 clickPos, float clickTime, float time, float aspect) {
    float timeSinceClick = time - clickTime;
    
    // Ripple parameters
    float rippleSpeed = 1.2;
    float rippleWidth = 0.25;
    float rippleDuration = 1.8;
    float maxRadius = 1.5;
    
    // Check if ripple is active
    float rippleAlive = step(0.0, timeSinceClick) * step(timeSinceClick, rippleDuration);
    if (rippleAlive < 0.5) return 0.0;
    
    // Aspect-corrected distance from click point
    vec2 aspectCorrectedUV = uv;
    aspectCorrectedUV.x *= aspect;
    vec2 aspectCorrectedClick = clickPos;
    aspectCorrectedClick.x *= aspect;
    
    float dist = distance(aspectCorrectedUV, aspectCorrectedClick);
    
    // Current ripple radius
    float rippleProgress = timeSinceClick / rippleDuration;
    float currentRadius = rippleProgress * maxRadius * rippleSpeed;
    
    // Ripple ring with wider effect zone
    float ringDist = abs(dist - currentRadius);
    float ring = smoothstep(rippleWidth, 0.0, ringDist);
    
    // Also affect area inside the ripple (fading trail)
    float inside = smoothstep(currentRadius, currentRadius * 0.3, dist) * 0.5;
    
    // Fade out over time
    float fadeOut = 1.0 - smoothstep(0.0, rippleDuration, timeSinceClick);
    
    return max(ring, inside) * fadeOut;
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Sample the original texture at full resolution (clean, non-pixelated)
    vec4 originalColor = texture2D(uTexture, uv);
    
    // Low FPS time - quantize time to 12fps for choppy animation
    float lowFpsTime = floor(uTime * 12.0) / 12.0;
    
    // Calculate all 3 ripples
    float ripple0 = calcRipple(uv, uClickPos0, uClickTime0, lowFpsTime, uAspect);
    float ripple1 = calcRipple(uv, uClickPos1, uClickTime1, lowFpsTime, uAspect);
    float ripple2 = calcRipple(uv, uClickPos2, uClickTime2, lowFpsTime, uAspect);
    
    // Combine ripple intensities
    float totalRipple = clamp(ripple0 + ripple1 + ripple2, 0.0, 1.0);
    
    // Character cell size (smaller = more chars)
    vec2 charCell = vec2(uCharSize) / uResolution;
    
    // Get the cell coordinates for ASCII sampling
    vec2 cellCoord = floor(uv / charCell);
    vec2 cellUV = fract(uv / charCell);
    
    // Sample the original texture at cell center for ASCII luminance
    vec2 sampleUV = (cellCoord + 0.5) * charCell;
    vec4 cellColor = texture2D(uTexture, sampleUV);
    
    // Get luminance from cell
    float luma = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Animated time offset for scrambling
    float timeOffset = floor(lowFpsTime * 15.0);
    
    // Calculate which ASCII character to use based on inverted luminance (dark areas = dense chars)
    int charIndex = int((1.0 - luma) * float(uCharCount - 1));
    
    // Add scrambling effect - randomize character selection inside ripple
    float scrambleAmount = totalRipple * 0.9;
    float scrambleRand = random(cellCoord + vec2(timeOffset * 0.1));
    
    // Scramble the character index with more chaos
    if (scrambleRand < scrambleAmount) {
      // Pick a random character with heavy randomization
      float randOffset = (random(cellCoord + vec2(timeOffset)) - 0.5) * float(uCharCount);
      charIndex = int(clamp(float(charIndex) + randOffset, 0.0, float(uCharCount - 1)));
    }
    
    // Calculate UV for the ASCII texture atlas (horizontal strip)
    float charU = (float(charIndex) + cellUV.x) / float(uCharCount);
    float charV = cellUV.y;
    
    // Sample the ASCII character
    vec4 asciiSample = texture2D(uAsciiTexture, vec2(charU, charV));
    float asciiValue = asciiSample.r;
    
    // Only show ASCII characters where original was dark (the logo)
    float darkness = step(0.5, 1.0 - luma);
    
    // White ASCII letters only - no black background
    // Where there's a letter AND it's in a dark area, show white; otherwise keep original
    float letterVisible = asciiValue * darkness;
    
    // Mix: in ripple area, show white ASCII chars on top of original (no black base)
    vec3 finalColor = mix(originalColor.rgb, vec3(1.0), letterVisible * totalRipple);
    
    gl_FragColor = vec4(finalColor, originalColor.a);
  }
`

export class RippleAsciiEffect {
  constructor(container, imageSrc, width, height) {
    this.container = container
    this.width = width
    this.height = height
    
    // Support 3 simultaneous ripples
    this.ripples = [
      { pos: new THREE.Vector2(0.5, 0.5), time: -10 },
      { pos: new THREE.Vector2(0.5, 0.5), time: -10 },
      { pos: new THREE.Vector2(0.5, 0.5), time: -10 }
    ]
    this.nextRippleIndex = 0
    
    // ASCII characters from dark to light (expanded set)
    this.asciiChars = ' .,:;!-~=+*?#%$&@XWMB'
    
    this.init(imageSrc)
  }
  
  async init(imageSrc) {
    // Create scene
    this.scene = new THREE.Scene()
    
    // Create camera
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10)
    this.camera.position.z = 1
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)
    
    // Load and rasterize SVG to canvas for proper texture
    const texture = await this.loadSVGAsTexture(imageSrc)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    
    // Create ASCII character atlas texture
    const asciiTexture = this.createAsciiTexture()
    
    // Create material with shaders
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uAsciiTexture: { value: asciiTexture },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uAspect: { value: this.width / this.height },
        uCharSize: { value: 6.0 },
        uCharCount: { value: this.asciiChars.length },
        uClickPos0: { value: new THREE.Vector2(0.5, 0.5) },
        uClickTime0: { value: -10 },
        uClickPos1: { value: new THREE.Vector2(0.5, 0.5) },
        uClickTime1: { value: -10 },
        uClickPos2: { value: new THREE.Vector2(0.5, 0.5) },
        uClickTime2: { value: -10 }
      },
      transparent: true
    })
    
    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(1, 1)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
    
    // Add event listeners
    this.addEventListeners()
    
    // Start animation
    this.animate()
  }
  
  createAsciiTexture() {
    const charSize = 24
    const canvas = document.createElement('canvas')
    canvas.width = charSize * this.asciiChars.length
    canvas.height = charSize
    const ctx = canvas.getContext('2d')
    
    // Clear with black (transparent)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw each character
    ctx.fillStyle = '#ffffff'
    ctx.font = `${charSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    for (let i = 0; i < this.asciiChars.length; i++) {
      const char = this.asciiChars[i]
      const x = i * charSize + charSize / 2
      const y = charSize / 2
      ctx.fillText(char, x, y)
    }
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.needsUpdate = true
    
    return texture
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
        
        // Fill with white background for visibility
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Draw SVG
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
    
    // Click event to trigger ripple (round-robin through 3 slots)
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect()
      const clickX = (e.clientX - rect.left) / rect.width
      const clickY = 1 - (e.clientY - rect.top) / rect.height
      
      // Use next ripple slot
      const ripple = this.ripples[this.nextRippleIndex]
      ripple.pos.x = clickX
      ripple.pos.y = clickY
      ripple.time = performance.now() * 0.001
      
      // Update uniform for this ripple
      this.material.uniforms[`uClickPos${this.nextRippleIndex}`].value.copy(ripple.pos)
      this.material.uniforms[`uClickTime${this.nextRippleIndex}`].value = ripple.time
      
      // Move to next slot (round-robin)
      this.nextRippleIndex = (this.nextRippleIndex + 1) % 3
    })
    
    // Add cursor pointer to indicate clickable
    canvas.style.cursor = 'pointer'
  }
  
  animate() {
    requestAnimationFrame(() => this.animate())
    
    // Update time uniform
    this.material.uniforms.uTime.value = performance.now() * 0.001
    
    this.renderer.render(this.scene, this.camera)
  }
  
  dispose() {
    this.renderer.dispose()
    this.material.dispose()
  }
}

import * as THREE from 'three'

// Vertex shader - simple passthrough
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader - ASCII art effect with scrambling characters
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform sampler2D uAsciiTexture;
  uniform float uTime;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform vec2 uResolution;
  uniform float uCharSize;
  uniform float uAspect;
  uniform int uCharCount;
  
  varying vec2 vUv;
  
  // Pseudo-random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  void main() {
    // Correct aspect ratio for circular aura
    vec2 aspectCorrectedUV = vUv;
    aspectCorrectedUV.x *= uAspect;
    vec2 aspectCorrectedMouse = uMouse;
    aspectCorrectedMouse.x *= uAspect;
    
    // Distance from mouse - circular
    float dist = distance(aspectCorrectedUV, aspectCorrectedMouse);
    float radius = 0.15 * uAspect;
    
    // Soft faded edge for aura - smooth transition at boundary
    float fadeWidth = 0.05 * uAspect;
    float insideAura = smoothstep(radius + fadeWidth, radius - fadeWidth, dist) * uHover;
    
    // Character cell size
    vec2 charCell = vec2(uCharSize) / uResolution;
    
    // Get the cell coordinates
    vec2 cellCoord = floor(vUv / charCell);
    vec2 cellUV = fract(vUv / charCell);
    
    // Sample the original texture at cell center
    vec2 sampleUV = (cellCoord + 0.5) * charCell;
    vec4 originalColor = texture2D(uTexture, sampleUV);
    
    // Get luminance
    float luma = dot(originalColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Animated time offset for scrambling
    float timeOffset = floor(uTime * 12.0);
    
    // Calculate which ASCII character to use based on luminance
    // Characters are arranged from dark to light in the texture
    int charIndex = int(luma * float(uCharCount - 1));
    
    // Add scrambling effect - randomize character selection inside aura
    float scrambleAmount = insideAura * 0.8;
    float scrambleRand = random(cellCoord + vec2(timeOffset * 0.1));
    
    // Scramble the character index
    if (scrambleRand < scrambleAmount) {
      // Pick a random character, biased towards similar luminance
      float randOffset = (random(cellCoord + vec2(timeOffset)) - 0.5) * float(uCharCount) * 0.6;
      charIndex = int(clamp(float(charIndex) + randOffset, 0.0, float(uCharCount - 1)));
    }
    
    // Calculate UV for the ASCII texture atlas (horizontal strip)
    float charU = (float(charIndex) + cellUV.x) / float(uCharCount);
    float charV = cellUV.y;
    
    // Sample the ASCII character
    vec4 asciiSample = texture2D(uAsciiTexture, vec2(charU, charV));
    float asciiValue = asciiSample.r;
    
    // Black areas of original become black ASCII letters on white background
    // White areas stay white (no ASCII visible)
    float darkness = step(0.5, 1.0 - luma); // Binary: 1 if dark, 0 if light
    
    // Black ASCII letters where original was dark, white background elsewhere
    // asciiValue = 1 where letter pixels are, 0 for background
    float letterVisible = asciiValue * darkness;
    vec3 asciiColor = vec3(1.0 - letterVisible); // 1 = white bg, 0 = black letter
    
    // Keep full opacity, pure white bg with black ASCII where original was dark
    gl_FragColor = vec4(mix(originalColor.rgb, asciiColor, insideAura), originalColor.a);
  }
`

export class AsciiScrambleEffect {
  constructor(container, imageSrc, width, height) {
    this.container = container
    this.width = width
    this.height = height
    this.mouse = new THREE.Vector2(0.5, 0.5)
    this.targetHover = 0
    this.currentHover = 0
    
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
        uHover: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uCharSize: { value: 8.0 },
        uAspect: { value: this.width / this.height },
        uCharCount: { value: this.asciiChars.length }
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
    const charSize = 16
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
    
    canvas.addEventListener('mouseenter', () => {
      this.targetHover = 1
    })
    
    canvas.addEventListener('mouseleave', () => {
      this.targetHover = 0
    })
    
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect()
      this.mouse.x = (e.clientX - rect.left) / rect.width
      this.mouse.y = 1 - (e.clientY - rect.top) / rect.height
    })
  }
  
  animate() {
    requestAnimationFrame(() => this.animate())
    
    // Smooth hover transition
    this.currentHover += (this.targetHover - this.currentHover) * 0.1
    
    // Update uniforms
    this.material.uniforms.uTime.value = performance.now() * 0.001
    this.material.uniforms.uHover.value = this.currentHover
    this.material.uniforms.uMouse.value.copy(this.mouse)
    
    this.renderer.render(this.scene, this.camera)
  }
  
  dispose() {
    this.renderer.dispose()
    this.material.dispose()
  }
}

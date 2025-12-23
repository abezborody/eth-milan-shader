import * as THREE from 'three'

// Vertex shader - simple passthrough
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader - hover trail triggers white ASCII scramble effect over clean SVG
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform sampler2D uAsciiTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uAspect;
  uniform float uCharSize;
  uniform int uCharCount;
  
  // Trail uniforms - 20 trail points as vec2 array
  uniform vec2 uTrailPos[20];
  uniform float uTrailTime[20];
  uniform int uTrailCount;
  
  varying vec2 vUv;
  
  // Pseudo-random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Calculate trail intensity with displacement direction
  vec3 calcTrailWithDisplacement(vec2 uv, vec2 trailPos, float trailTime, float time, float aspect) {
    float timeSinceTrail = time - trailTime;
    
    // Trail parameters
    float trailDuration = 1.5;
    float maxRadius = 0.8;
    float minRadius = 0.1;
    
    // Check if trail point is active
    float trailAlive = step(0.0, timeSinceTrail) * step(timeSinceTrail, trailDuration);
    if (trailAlive < 0.5) return vec3(0.0);
    
    // Aspect-corrected distance from trail point
    vec2 aspectCorrectedUV = uv;
    aspectCorrectedUV.x *= aspect;
    vec2 aspectCorrectedTrail = trailPos;
    aspectCorrectedTrail.x *= aspect;
    
    float dist = distance(aspectCorrectedUV, aspectCorrectedTrail);
    
    // Create smooth gradient trail (stronger at center, fading out)
    float trailStrength = 1.0 - (timeSinceTrail / trailDuration);
    float radius = minRadius + (maxRadius - minRadius) * (1.0 - trailStrength);
    
    // Smooth falloff from center
    float intensity = smoothstep(radius, 0.0, dist);
    
    // Apply time-based fade
    float fadeOut = 1.0 - smoothstep(0.0, trailDuration, timeSinceTrail);
    
    // Direction from trail point for displacement
    vec2 direction = normalize(uv - trailPos);
    
    // Return: x = intensity, y = direction.x, z = direction.y
    return vec3(intensity * fadeOut, direction.x, direction.y);
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Low FPS time - quantize time to 12fps for choppy animation
    float lowFpsTime = floor(uTime * 14.0) / 14.0;
    
    // Calculate all trail points with displacement
    vec3 totalDisplacement = vec3(0.0);
    for (int i = 0; i < 20; i++) {
      if (i >= uTrailCount) break;
      vec3 trail = calcTrailWithDisplacement(uv, uTrailPos[i], uTrailTime[i], lowFpsTime, uAspect);
      totalDisplacement.x += trail.x;
      totalDisplacement.yz += trail.yz * trail.x;
    }
    
    // Clamp total trail intensity
    float totalTrail = clamp(totalDisplacement.x, 0.0, 1.0);
    
    // Calculate combined displacement direction (weighted by intensity)
    vec2 displacement = totalDisplacement.yz;
    
    // Apply UV displacement - reduced strength for very subtle effect
    float displacementStrength = 0.006; // Reduced from 0.015
    vec2 displacedUV = uv - displacement * displacementStrength;
    
    // Sample the original texture at displaced UV
    vec4 originalColor = texture2D(uTexture, displacedUV);
    
    // Character cell size (smaller = more chars)
    vec2 charCell = vec2(uCharSize) / uResolution;
    
    // Get the cell coordinates for ASCII sampling (use displaced UV)
    vec2 cellCoord = floor(displacedUV / charCell);
    vec2 cellUV = fract(displacedUV / charCell);
    
    // Sample the original texture at cell center for ASCII luminance
    vec2 sampleUV = (cellCoord + 0.5) * charCell;
    vec4 cellColor = texture2D(uTexture, sampleUV);
    
    // Get luminance from cell
    float luma = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Animated time offset for scrambling
    float timeOffset = floor(lowFpsTime * 15.0);
    
    // Calculate which ASCII character to use based on inverted luminance (dark areas = dense chars)
    int charIndex = int((1.0 - luma) * float(uCharCount - 1));
    
    // Add scrambling effect - randomize character selection inside trail
    float scrambleAmount = totalTrail * 0.9;
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
    
    // Pixelated darkness from cell-sampled luma (matches ASCII grid exactly)
    float darkness = smoothstep(0.75, 0.25, luma);
    
    // Add extra noise to ASCII characters
    float charNoise = random(cellCoord + vec2(timeOffset * 0.3)) * 0.3;
    float noisyAscii = clamp(asciiValue + charNoise - 0.15, 0.0, 1.0);
    
    // White ASCII letters on transparent background
    float letterVisible = noisyAscii * darkness;
    
    // In trail: show pure white letters with transparency
    vec3 finalColor = mix(originalColor.rgb, vec3(1.0), totalTrail * letterVisible);
    
    // Alpha channel - transparent where no letters, opaque where letters appear
    float finalAlpha = mix(originalColor.a, max(originalColor.a, letterVisible), totalTrail);
    
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`

export class HoverTrailAsciiWhiteEffect {
  constructor(container, imageSrc, width, height) {
    this.container = container
    this.width = width
    this.height = height
    
    // Trail system - 20 points for smooth trail
    this.maxTrailPoints = 20
    this.trailPoints = []
    for (let i = 0; i < this.maxTrailPoints; i++) {
      this.trailPoints.push({
        pos: new THREE.Vector2(0.5, 0.5),
        time: -10
      })
    }
    this.trailHead = 0
    this.trailCount = 0
    
    // Mouse tracking
    this.mouseX = 0.5
    this.mouseY = 0.5
    this.lastMouseX = 0.5
    this.lastMouseY = 0.5
    this.isMouseOver = false
    this.lastTrailTime = 0 // Time-based cooldown for trail points
    
    // ASCII characters from dark to light
    this.asciiChars = ' .,:;!#%$&@X10ETHMILAN'
    
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
    
    // Prepare trail uniforms as array of Vector2 objects
    const trailPosValues = []
    const trailTimeValues = []
    for (let i = 0; i < this.maxTrailPoints; i++) {
      trailPosValues.push(new THREE.Vector2(0.5, 0.5))
      trailTimeValues.push(-10)
    }
    
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
        uCharSize: { value: 8.0 },
        uCharCount: { value: this.asciiChars.length },
        uTrailPos: { value: trailPosValues },
        uTrailTime: { value: trailTimeValues },
        uTrailCount: { value: 0 }
      },
      transparent: true
    })
    
    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(1, 1)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
    
    // Store references to uniform arrays for easy updates
    this.trailPosUniform = this.material.uniforms.uTrailPos
    this.trailTimeUniform = this.material.uniforms.uTrailTime
    
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
    
    // Mouse move event to create trail
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect()
      this.lastMouseX = this.mouseX
      this.lastMouseY = this.mouseY
      this.mouseX = (e.clientX - rect.left) / rect.width
      this.mouseY = 1 - (e.clientY - rect.top) / rect.height
      
      // Only add trail point if mouse moved enough AND enough time has passed
      const moveDist = Math.sqrt(
        (this.mouseX - this.lastMouseX) ** 2 + 
        (this.mouseY - this.lastMouseY) ** 2
      )
      
      const currentTime = performance.now()
      const timeSinceLastTrail = currentTime - this.lastTrailTime
      
      if (moveDist > 0.01 && timeSinceLastTrail > 30) { // 30ms cooldown
        this.addTrailPoint(this.mouseX, this.mouseY)
        this.lastTrailTime = currentTime
      }
    })
    
    // Mouse enter/leave events
    canvas.addEventListener('mouseenter', () => {
      this.isMouseOver = true
    })
    
    canvas.addEventListener('mouseleave', () => {
      this.isMouseOver = false
    })
    
    // Add cursor pointer to indicate interactive
    canvas.style.cursor = 'crosshair'
  }
  
  addTrailPoint(x, y) {
    // Add new trail point at the head
    const point = this.trailPoints[this.trailHead]
    point.pos.x = x
    point.pos.y = y
    point.time = performance.now() * 0.001
    
    // Update uniforms - use Vector2.set() method
    this.trailPosUniform.value[this.trailHead].set(x, y)
    this.trailTimeUniform.value[this.trailHead] = point.time
    
    // Move head forward (circular buffer)
    this.trailHead = (this.trailHead + 1) % this.maxTrailPoints
    
    // Update trail count
    if (this.trailCount < this.maxTrailPoints) {
      this.trailCount++
    }
    this.material.uniforms.uTrailCount.value = this.trailCount
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

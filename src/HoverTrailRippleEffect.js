import * as THREE from 'three'

// Vertex shader - simple passthrough
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader - hover trail with pixelated dithering effect
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uAspect;
  
  // Trail uniforms - 20 trail points as vec2 array
  uniform vec2 uTrailPos[20];
  uniform float uTrailTime[20];
  uniform int uTrailCount;
  
  varying vec2 vUv;
  
  // Pseudo-random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Bayer matrix 8x8 for ordered dithering
  float bayer8x8(vec2 pos) {
    int x = int(mod(pos.x, 8.0));
    int y = int(mod(pos.y, 8.0));
    int index = x + y * 8;
    
    // Bayer 8x8 matrix values normalized to 0-1
    float matrix[64];
    matrix[0] = 0.0/64.0;   matrix[1] = 32.0/64.0;  matrix[2] = 8.0/64.0;   matrix[3] = 40.0/64.0;
    matrix[4] = 2.0/64.0;   matrix[5] = 34.0/64.0;  matrix[6] = 10.0/64.0;  matrix[7] = 42.0/64.0;
    matrix[8] = 48.0/64.0;  matrix[9] = 16.0/64.0;  matrix[10] = 56.0/64.0; matrix[11] = 24.0/64.0;
    matrix[12] = 50.0/64.0; matrix[13] = 18.0/64.0; matrix[14] = 58.0/64.0; matrix[15] = 26.0/64.0;
    matrix[16] = 12.0/64.0; matrix[17] = 44.0/64.0; matrix[18] = 4.0/64.0;  matrix[19] = 36.0/64.0;
    matrix[20] = 14.0/64.0; matrix[21] = 46.0/64.0; matrix[22] = 6.0/64.0;  matrix[23] = 38.0/64.0;
    matrix[24] = 60.0/64.0; matrix[25] = 28.0/64.0; matrix[26] = 52.0/64.0; matrix[27] = 20.0/64.0;
    matrix[28] = 62.0/64.0; matrix[29] = 30.0/64.0; matrix[30] = 54.0/64.0; matrix[31] = 22.0/64.0;
    matrix[32] = 3.0/64.0;  matrix[33] = 35.0/64.0; matrix[34] = 11.0/64.0; matrix[35] = 43.0/64.0;
    matrix[36] = 1.0/64.0;  matrix[37] = 33.0/64.0; matrix[38] = 9.0/64.0;  matrix[39] = 41.0/64.0;
    matrix[40] = 51.0/64.0; matrix[41] = 19.0/64.0; matrix[42] = 59.0/64.0; matrix[43] = 27.0/64.0;
    matrix[44] = 49.0/64.0; matrix[45] = 17.0/64.0; matrix[46] = 57.0/64.0; matrix[47] = 25.0/64.0;
    matrix[48] = 15.0/64.0; matrix[49] = 47.0/64.0; matrix[50] = 7.0/64.0;  matrix[51] = 39.0/64.0;
    matrix[52] = 13.0/64.0; matrix[53] = 45.0/64.0; matrix[54] = 5.0/64.0;  matrix[55] = 37.0/64.0;
    matrix[56] = 63.0/64.0; matrix[57] = 31.0/64.0; matrix[58] = 55.0/64.0; matrix[59] = 23.0/64.0;
    matrix[60] = 61.0/64.0; matrix[61] = 29.0/64.0; matrix[62] = 53.0/64.0; matrix[63] = 21.0/64.0;
    
    for (int i = 0; i < 64; i++) {
      if (i == index) return matrix[i];
    }
    return 0.0;
  }
  
  // Calculate trail intensity
  float calcTrail(vec2 uv, vec2 trailPos, float trailTime, float time, float aspect) {
    float timeSinceTrail = time - trailTime;
    
    // Trail parameters
    float trailDuration = 1.5;
    float maxRadius = 0.8;
    float minRadius = 0.1;
    
    // Check if trail point is active
    float trailAlive = step(0.0, timeSinceTrail) * step(timeSinceTrail, trailDuration);
    if (trailAlive < 0.5) return 0.0;
    
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
    
    return intensity * fadeOut;
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Low FPS time - quantize time to 6fps for choppy animation
    float lowFpsTime = floor(uTime * 12.0) / 12.0;
    
    // Calculate all trail points
    float totalTrail = 0.0;
    for (int i = 0; i < 20; i++) {
      if (i >= uTrailCount) break;
      float trail = calcTrail(uv, uTrailPos[i], uTrailTime[i], lowFpsTime, uAspect);
      totalTrail += trail;
    }
    
    // Clamp total trail intensity
    totalTrail = clamp(totalTrail, 0.0, 1.0);
    
    // Sample texture with original UVs (no displacement)
    vec4 originalColor = texture2D(uTexture, uv);
    
    // Get luminance
    float luma = dot(originalColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Smaller pixel size for finer dithering
    float pixelSize = 1.5;
    vec2 pixelCoord = floor(uv * uResolution / pixelSize);
    
    // Low fps time offset for choppy dithering animation
    float timeOffset = floor(lowFpsTime * 8.0);
    vec2 animatedPixel = pixelCoord + vec2(
      random(vec2(timeOffset, 0.0)) * 8.0,
      random(vec2(0.0, timeOffset)) * 8.0
    );
    
    // Get Bayer threshold for this pixel
    float bayerThreshold = bayer8x8(animatedPixel);
    
    // Add more noise over time inside trail - increases with trail intensity
    float noiseIntensity = 0.3 * totalTrail;
    float timeNoise = random(pixelCoord + vec2(timeOffset * 0.5)) * noiseIntensity;
    float spatialNoise = random(pixelCoord * 0.1 + vec2(timeOffset)) * noiseIntensity * 0.5;
    float noise = (timeNoise + spatialNoise) - noiseIntensity * 0.5;
    float threshold = bayerThreshold + noise;
    
    // Apply dithering - black or white based on luminance vs threshold
    float dithered = step(threshold, luma);
    vec3 ditheredColor = vec3(dithered);
    
    // Trail color - white like the original
    vec3 trailColor = vec3(1.0, 1.0, 1.0);
    
    // Mix dithered with white tint based on trail intensity
    vec3 coloredDither = mix(ditheredColor, ditheredColor * trailColor, 0.7);
    
    // Mix original with colored dithered based on trail intensity
    vec3 finalColor = mix(originalColor.rgb, coloredDither, totalTrail);
    
    gl_FragColor = vec4(finalColor, originalColor.a);
  }
`

export class HoverTrailRippleEffect {
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
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uAspect: { value: this.width / this.height },
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
      
      // Only add trail point if mouse moved enough
      const moveDist = Math.sqrt(
        (this.mouseX - this.lastMouseX) ** 2 + 
        (this.mouseY - this.lastMouseY) ** 2
      )
      
      if (moveDist > 0.01) {
        this.addTrailPoint(this.mouseX, this.mouseY)
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

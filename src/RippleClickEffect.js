import * as THREE from 'three'

// Vertex shader - simple passthrough
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader - pixelating ripple/shockwave effect on click (supports 3 ripples)
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uAspect;
  
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
  
  // Calculate ripple with displacement info
  vec3 calcRippleWithDisplacement(vec2 uv, vec2 clickPos, float clickTime, float time, float aspect) {
    float timeSinceClick = time - clickTime;
    
    // Ripple parameters
    float rippleSpeed = 1.2;
    float rippleWidth = 0.3;
    float rippleDuration = 1.6;
    float maxRadius = 1.5;
    
    // Check if ripple is active
    float rippleAlive = step(0.0, timeSinceClick) * step(timeSinceClick, rippleDuration);
    if (rippleAlive < 0.5) return vec3(0.0);
    
    // Aspect-corrected distance from click point
    vec2 aspectCorrectedUV = uv;
    aspectCorrectedUV.x *= aspect;
    vec2 aspectCorrectedClick = clickPos;
    aspectCorrectedClick.x *= aspect;
    
    float dist = distance(aspectCorrectedUV, aspectCorrectedClick);
    
    // Current ripple radius
    float rippleProgress = timeSinceClick / rippleDuration;
    float currentRadius = rippleProgress * maxRadius * rippleSpeed;
    
    // Ripple ring
    float ringDist = abs(dist - currentRadius);
    float ring = smoothstep(rippleWidth, 0.0, ringDist);
    
    // Fade out over time
    float fadeOut = 1.0 - smoothstep(0.0, rippleDuration, timeSinceClick);
    
    // Direction from click point for displacement
    vec2 direction = normalize(uv - clickPos);
    
    // Return: x = intensity, y = direction.x, z = direction.y
    return vec3(ring * fadeOut, direction.x, direction.y);
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Low FPS time - quantize time to 6fps for choppy animation
    float lowFpsTime = floor(uTime * 12.0) / 12.0;
    
    // Calculate all 3 ripples with displacement (using low fps time)
    vec3 ripple0 = calcRippleWithDisplacement(uv, uClickPos0, uClickTime0, lowFpsTime, uAspect);
    vec3 ripple1 = calcRippleWithDisplacement(uv, uClickPos1, uClickTime1, lowFpsTime, uAspect);
    vec3 ripple2 = calcRippleWithDisplacement(uv, uClickPos2, uClickTime2, lowFpsTime, uAspect);
    
    // Combine ripple intensities
    float totalRipple = max(max(ripple0.x, ripple1.x), ripple2.x);
    
    // Calculate combined displacement direction (weighted by intensity)
    vec2 displacement = vec2(0.0);
    displacement += ripple0.yz * ripple0.x;
    displacement += ripple1.yz * ripple1.x;
    displacement += ripple2.yz * ripple2.x;
    
    // Apply UV displacement - wave distortion effect
    float displacementStrength = 0.01;
    vec2 displacedUV = uv - displacement * displacementStrength;
    
    // Sample texture with displaced UVs
    vec4 originalColor = texture2D(uTexture, displacedUV);
    
    // Get luminance to detect letters (darker areas)
    float luma = dot(originalColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Create mask for letters - areas that are not white background
    // Letters are darker than white, so we use inverse luminance
    float letterMask = 1.0 - smoothstep(0.85, 0.95, luma);
    
    // Smaller pixel size for finer dithering
    float pixelSize = 1.5;
    vec2 pixelCoord = floor(displacedUV * uResolution / pixelSize);
    
    // Low fps time offset for choppy dithering animation
    float timeOffset = floor(lowFpsTime * 8.0);
    vec2 animatedPixel = pixelCoord + vec2(
      random(vec2(timeOffset, 0.0)) * 8.0,
      random(vec2(0.0, timeOffset)) * 8.0
    );
    
    // Get Bayer threshold for this pixel
    float bayerThreshold = bayer8x8(animatedPixel);
    
    // Add more noise over time inside ripple - increases with ripple intensity
    float noiseIntensity = 0.3 * totalRipple;
    float timeNoise = random(pixelCoord + vec2(timeOffset * 0.5)) * noiseIntensity;
    float spatialNoise = random(pixelCoord * 0.1 + vec2(timeOffset)) * noiseIntensity * 0.5;
    float noise = (timeNoise + spatialNoise) - noiseIntensity * 0.5;
    float threshold = bayerThreshold + noise;
    
    // Apply dithering - black or white based on luminance vs threshold
    float dithered = step(threshold, luma);
    vec3 ditheredColor = vec3(dithered);
    
    // Ripple color FF2727 (red)
    vec3 rippleColor = vec3(1.0, 1.0, 1.0);
    
    // Mix dithered with red tint based on ripple intensity
    vec3 coloredDither = mix(ditheredColor, ditheredColor * rippleColor, 0.7);
    
    // Apply letterMask to ripple intensity - ripples only affect letters
    float maskedRippleIntensity = totalRipple * letterMask;
    
    // Mix original with colored dithered based on masked ripple intensity
    vec3 finalColor = mix(originalColor.rgb, coloredDither, maskedRippleIntensity);
    
    gl_FragColor = vec4(finalColor, originalColor.a);
  }
`

export class RippleClickEffect {
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
    
    // Create material with shaders
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uAspect: { value: this.width / this.height },
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

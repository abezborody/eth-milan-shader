import * as THREE from 'three'

// Vertex shader - simple passthrough
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader - dithering/scramble effect
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform vec2 uResolution;
  uniform float uPixelSize;
  uniform float uAspect;
  
  varying vec2 vUv;
  
  // Pseudo-random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Bayer matrix 4x4 for ordered dithering
  float bayer4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;
    
    // Bayer matrix values (0-15 normalized to 0-1)
    float matrix[16];
    matrix[0] = 0.0/16.0;   matrix[1] = 8.0/16.0;   matrix[2] = 2.0/16.0;   matrix[3] = 10.0/16.0;
    matrix[4] = 12.0/16.0;  matrix[5] = 4.0/16.0;   matrix[6] = 14.0/16.0;  matrix[7] = 6.0/16.0;
    matrix[8] = 3.0/16.0;   matrix[9] = 11.0/16.0;  matrix[10] = 1.0/16.0;  matrix[11] = 9.0/16.0;
    matrix[12] = 15.0/16.0; matrix[13] = 7.0/16.0;  matrix[14] = 13.0/16.0; matrix[15] = 5.0/16.0;
    
    for (int i = 0; i < 16; i++) {
      if (i == index) return matrix[i];
    }
    return 0.0;
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
    
    // Fixed pixel sizes - normal outside, larger inside aura
    float normalPixelSize = uPixelSize;
    float largePixelSize = uPixelSize * 4.0;
    
    // Calculate both pixel grids
    vec2 normalPixel = vec2(normalPixelSize) / uResolution;
    vec2 largePixel = vec2(largePixelSize) / uResolution;
    
    vec2 normalUV = floor(vUv / normalPixel) * normalPixel;
    vec2 largeUV = floor(vUv / largePixel) * largePixel;
    
    // Sample both textures
    vec4 normalColor = texture2D(uTexture, normalUV);
    vec4 largeColor = texture2D(uTexture, largeUV);
    
    // Blend between normal and pixelated based on soft aura
    vec4 color = mix(normalColor, largeColor, insideAura);
    
    // Animated time offset
    float timeOffset = floor(uTime * 15.0);
    vec2 pixelCoord = floor(vUv * uResolution / largePixelSize);
    
    // Get luminance
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Dithering with Bayer matrix
    vec2 animatedPixel = pixelCoord + vec2(
      random(vec2(timeOffset, 0.0)) * 4.0,
      random(vec2(0.0, timeOffset)) * 4.0
    );
    float threshold = bayer4x4(animatedPixel);
    float animThreshold = threshold + random(pixelCoord + timeOffset * 0.05) * 0.3 - 0.15;
    animThreshold = clamp(animThreshold, 0.0, 1.0);
    
    // Apply dithering only inside aura
    float dithered = step(animThreshold, luma);
    float ditheredLuma = mix(luma, dithered, insideAura);
    
    // Final color - no red tint, just pixelation and dithering
    vec3 finalColor = mix(color.rgb, vec3(ditheredLuma), insideAura);
    
    gl_FragColor = vec4(finalColor, color.a);
  }
`

export class PixelScrambleEffect {
  constructor(container, imageSrc, width, height) {
    this.container = container
    this.width = width
    this.height = height
    this.mouse = new THREE.Vector2(0.5, 0.5)
    this.targetHover = 0
    this.currentHover = 0
    
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
        uHover: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uPixelSize: { value: 0.5 },
        uAspect: { value: this.width / this.height }
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

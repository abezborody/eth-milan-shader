import * as THREE from 'three'

// Vertex shader - simple passthrough
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader - combines wave displacement with centered coin
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uSize;
  uniform float uSpeed;
  uniform float uScale;
  uniform vec3 uColorFront;
  uniform vec3 uColorBack;
  uniform vec2 uImageSize; // Size of the coin in UV coordinates (for positioning)
  
  varying vec2 vUv;
  
  // Pseudo-random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Noise function
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
  
  // Fractal noise for more detail
  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.7;
    float frequency = 0.0;
    
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(st);
      st *= 2.0;
      amplitude *= 0.5;
    }
    
    return value;
  }
  
  // 4x4 Bayer matrix for ordered dithering
  float bayer4x4(vec2 uv) {
    const float threshold[16] = float[](
      0.0,  8.0,  2.0, 10.0,
      12.0, 4.0, 14.0, 6.0,
      3.0, 11.0, 1.0,  9.0,
      15.0, 7.0, 13.0, 5.0
    );
    
    // Scale UV based on size parameter
    vec2 scaledUV = uv * uResolution / uSize;
    vec2 grid = floor(scaledUV);
    vec2 subPixel = fract(scaledUV);
    
    // Get Bayer matrix index
    int index = int(mod(grid.y * 4.0 + grid.x, 16.0));
    
    return threshold[index] / 16.0;
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Calculate coin UV coordinates (positioned in right-bottom corner)
    vec2 coinUV = uv - vec2(0.7, 0.3); // Position in right-bottom corner
    coinUV /= uImageSize; // Scale to fit coin size
    coinUV += vec2(0.5); // Re-center
    
    // Check if we're within the coin bounds
    vec2 coinBounds = step(vec2(0.0), coinUV) * step(coinUV, vec2(1.0));
    float inCoin = coinBounds.x * coinBounds.y;
    
    // Add smooth transition at coin edges
    vec2 edgeDistance = min(coinUV, 1.0 - coinUV);
    float minEdgeDistance = min(edgeDistance.x, edgeDistance.y);
    float smoothEdge = smoothstep(0.0, 0.2, minEdgeDistance);
    inCoin *= smoothEdge;
    
    // Background with wave displacement (Y-axis only, bottom half only)
    vec2 displacement = vec2(0.0);
    
    // Restrict waves to bottom half of container
    float waveMask = 1.0 - smoothstep(0.45, 0.5, uv.y);
    
    // Apply Y-axis displacement only in bottom half
    displacement.y = fbm(uv * uScale - uTime * uSpeed * 0.7) * 0.1 * waveMask;
    
    // Apply displacement only to background color, not to dithering UVs
    vec2 displacedUV = uv + displacement;
    
    // Generate background pattern - use original UV for dithering to keep dots consistent
    float bgNoiseValue = fbm(displacedUV * 5.0); // Apply waves only to noise
    float bgDither = bayer4x4(uv); // Use original UV for consistent dithering
    float bgPattern = bgNoiseValue + bgDither * 1.0;
    float bgThreshold = smoothstep(0.3, 0.66, bgPattern);
    vec3 bgColor = mix(uColorBack, uColorFront, bgThreshold);
    
    // Coin with dithering
    vec4 coinColor = texture2D(uTexture, coinUV);
    
    // Cut out fully transparent pixels
    if (coinColor.a < 0.01) {
      inCoin = 0.0;
    }
    
    // Apply contrast filter to make coin more defined
    vec3 filteredColor = coinColor.rgb;
    float brightness = dot(filteredColor, vec3(0.299, 0.587, 0.114));
    filteredColor = mix(vec3(brightness), filteredColor, 1.5); // Increase color saturation
    brightness = dot(filteredColor, vec3(0.299, 0.587, 0.114));
    brightness = pow(brightness, 1.4); // Adjust contrast
    
    float coinGray = brightness;
    float coinDither = bayer4x4(uv);
    float coinPattern = coinGray + coinDither * 0.6;
    float coinThreshold = smoothstep(0.1, 0.8, coinPattern);
    vec3 coinColorFinal = mix(uColorFront, uColorBack, coinThreshold);
    
    // Use mix instead of if/else for better performance
    vec3 color = mix(bgColor, coinColorFinal, inCoin);
    
    // Add subtle animation
    float flicker = sin(uTime * uSpeed * 2.0) * 0.02;
    color += flicker;
    
    gl_FragColor = vec4(color, 1.0);
  }
`

export class Coin3DEffect {
  constructor(container, imageSrc, width, height) {
    this.container = container
    this.width = width || window.innerWidth
    this.height = height || 600
    this.imageSrc = imageSrc || '/ethereum-eth-logo.svg'
    
    // Shader parameters (same as WaveDitheringImageEffect)
    this.speed = 0.2
    this.size = 3.0
    this.scale = 2.0
    this.colorFront = new THREE.Color('#0F0F0F')
    this.colorBack = new THREE.Color('#FFFFFF')
    
    // Coin will be positioned in right-bottom corner
    this.imageScale = 2.0 // Larger scale for coin
    
    this.init()
  }
  
  async init() {
    // Create scene
    this.scene = new THREE.Scene()
    
    // Create camera
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10)
    this.camera.position.z = 1
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false 
    })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 1.0)
    this.container.appendChild(this.renderer.domElement)
    
    // Create coin texture using the main renderer
    const texture = await this.createCoinTexture()
    
    // Calculate coin aspect ratio (render target is square 512x512)
    const coinAspect = 1.0; // Square render target
    const containerAspect = this.width / this.height
    
    let coinUVSize
    if (coinAspect > containerAspect) {
      // Coin is wider than container - fit to width
      coinUVSize = new THREE.Vector2(this.imageScale, this.imageScale / coinAspect * containerAspect)
    } else {
      // Coin is taller than container - fit to height
      coinUVSize = new THREE.Vector2(this.imageScale * coinAspect / containerAspect, this.imageScale)
    }
    
    // Create material with shaders
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
        uSpeed: { value: this.speed },
        uSize: { value: this.size },
        uScale: { value: this.scale },
        uColorFront: { value: this.colorFront },
        uColorBack: { value: this.colorBack },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uImageSize: { value: coinUVSize }
      }
    })
    
    // Check for shader compilation errors
    if (this.material.program) {
      const gl = this.renderer.getContext()
      const program = this.material.program
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Shader program failed to link:', gl.getProgramInfoLog(program))
      }
      
      const vertexShader = gl.getShaderAttached(program, gl.VERTEX_SHADER)
      if (vertexShader && !gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader))
      }
      
      const fragmentShader = gl.getShaderAttached(program, gl.FRAGMENT_SHADER)
      if (fragmentShader && !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader))
      }
    }
    
    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(1, 1)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
    
    // Start animation
    this.animate()
  }
  
  async createCoinTexture() {
    // Create a separate scene for the 3D coin
    const coinScene = new THREE.Scene()
    const coinCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    
    // Create render target
    const renderTarget = new THREE.WebGLRenderTarget(512, 512)
    
    // Create coin geometry
    const coinGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 64)
    
    // Create coin material - metallic gold without texture
    const coinMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.9,
      roughness: 0.1,
      color: 0xFFD700
    })
    
    // Create coin mesh with rotation
    const coin = new THREE.Mesh(coinGeometry, coinMaterial)
    coin.rotation.x = 0.4 // Rotate up/left
    coin.rotation.y = 0.5 // Rotate left
    coin.rotation.z = 0.6 // Slight tilt
    
    coinScene.add(coin)
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    coinScene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
    directionalLight.position.set(2, 2, 2)
    coinScene.add(directionalLight)
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight2.position.set(-1, -1, 1)
    coinScene.add(directionalLight2)
    
    // Position camera
    coinCamera.position.z = 3
    
    // IMPORTANT: Store the current render target and clear color
    const currentRenderTarget = this.renderer.getRenderTarget()
    const currentClearColor = this.renderer.getClearColor()
    const currentClearAlpha = this.renderer.getClearAlpha()
    
    // Render coin to texture using the main renderer
    this.renderer.setClearColor(0x000000, 0) // Transparent background
    this.renderer.setRenderTarget(renderTarget)
    this.renderer.render(coinScene, coinCamera)
    this.renderer.setRenderTarget(currentRenderTarget) // Restore previous render target
    this.renderer.setClearColor(currentClearColor, currentClearAlpha) // Restore clear color
    
    // Debug: Check if render target has content
    const pixels = new Uint8Array(4)
    this.renderer.readRenderTargetPixels(renderTarget, 256, 256, 1, 1, pixels)
    console.log('Coin texture pixel at center:', pixels)
    
    // Clean up
    coinGeometry.dispose()
    coinMaterial.dispose()
    
    return renderTarget.texture
  }
  
  loadTexture(src) {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader()
      loader.load(
        src,
        (texture) => {
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter
          texture.wrapS = THREE.ClampToEdgeWrapping
          texture.wrapT = THREE.ClampToEdgeWrapping
          resolve(texture)
        },
        undefined,
        (error) => {
          console.warn('Failed to load texture:', error)
          // Create a dummy texture if loading fails
          const canvas = document.createElement('canvas')
          canvas.width = 512
          canvas.height = 512
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#FFD700'
          ctx.fillRect(0, 0, 512, 512)
          ctx.fillStyle = '#000'
          ctx.font = 'bold 200px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('HUY', 256, 256)
          const dummyTexture = new THREE.CanvasTexture(canvas)
          resolve(dummyTexture)
        }
      )
    })
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

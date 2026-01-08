import * as THREE from 'three'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uAspect;
  
  uniform vec2 uClickPos0;
  uniform float uClickTime0;
  uniform vec2 uClickPos1;
  uniform float uClickTime1;
  uniform vec2 uClickPos2;
  uniform float uClickTime2;
  
  varying vec2 vUv;
  
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  float bayer8x8(vec2 pos) {
    int x = int(mod(pos.x, 8.0));
    int y = int(mod(pos.y, 8.0));
    int index = x + y * 8;
    
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
  
  float calcRipple(vec2 uv, vec2 clickPos, float clickTime, float time, float aspect) {
    float timeSinceClick = time - clickTime;
    
    float rippleSpeed = 1.2;
    float rippleWidth = 0.3;
    float rippleDuration = 1.6;
    float maxRadius = 1.5;
    
    float rippleAlive = step(0.0, timeSinceClick) * step(timeSinceClick, rippleDuration);
    if (rippleAlive < 0.5) return 0.0;
    
    vec2 aspectCorrectedUV = uv;
    aspectCorrectedUV.x *= aspect;
    vec2 aspectCorrectedClick = clickPos;
    aspectCorrectedClick.x *= aspect;
    
    float dist = distance(aspectCorrectedUV, aspectCorrectedClick);
    
    float rippleProgress = timeSinceClick / rippleDuration;
    float currentRadius = rippleProgress * maxRadius * rippleSpeed;
    
    float ringDist = abs(dist - currentRadius);
    float ring = smoothstep(rippleWidth, 0.0, ringDist);
    
    float fadeOut = 1.0 - smoothstep(0.0, rippleDuration, timeSinceClick);
    
    return ring * fadeOut;
  }
  
  void main() {
    vec2 uv = vUv;
    
    float lowFpsTime = floor(uTime * 12.0) / 12.0;
    
    float ripple0 = calcRipple(uv, uClickPos0, uClickTime0, lowFpsTime, uAspect);
    float ripple1 = calcRipple(uv, uClickPos1, uClickTime1, lowFpsTime, uAspect);
    float ripple2 = calcRipple(uv, uClickPos2, uClickTime2, lowFpsTime, uAspect);
    
    float totalRipple = max(max(ripple0, ripple1), ripple2);
    
    vec4 texColor = texture2D(uTexture, uv);
    float alpha = texColor.a;
    
    bool isLetter = alpha > 0.1;
    
    if (!isLetter && totalRipple < 0.01) {
      discard;
    }
    
    float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    
    float pixelSize = 1.5;
    vec2 pixelCoord = floor(uv * uResolution / pixelSize);
    
    float timeOffset = floor(lowFpsTime * 8.0);
    vec2 animatedPixel = pixelCoord + vec2(
      random(vec2(timeOffset, 0.0)) * 8.0,
      random(vec2(0.0, timeOffset)) * 8.0
    );
    
    float bayerThreshold = bayer8x8(animatedPixel);
    
    float noiseIntensity = 0.3 * totalRipple;
    float timeNoise = random(pixelCoord + vec2(timeOffset * 0.5)) * noiseIntensity;
    float spatialNoise = random(pixelCoord * 0.1 + vec2(timeOffset)) * noiseIntensity * 0.5;
    float noise = (timeNoise + spatialNoise) - noiseIntensity * 0.5;
    float threshold = bayerThreshold + noise;
    
    float dithered = step(threshold, luma);
    vec3 ditheredColor = vec3(dithered);
    
    vec3 rippleColor = vec3(1.0, 1.0, 1.0);
    
    vec3 coloredDither = mix(ditheredColor, ditheredColor * rippleColor, 0.7);
    
    vec3 finalColor;
    float finalAlpha;
    
    if (isLetter) {
      finalColor = mix(texColor.rgb, coloredDither, totalRipple);
      finalAlpha = alpha;
    } else {
      float invertedDithered = 1.0 - step(threshold, totalRipple * 0.5);
      vec3 blackDots = vec3(invertedDithered);
      finalColor = blackDots;
      finalAlpha = (1.0 - invertedDithered) * totalRipple;
    }
    
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`

export class RippleClickEffectV2 {
  constructor(container, imageSrc, width, height) {
    this.container = container
    this.width = width
    this.height = height
    
    this.ripples = [
      { pos: new THREE.Vector2(0.5, 0.5), time: -10 },
      { pos: new THREE.Vector2(0.5, 0.5), time: -10 },
      { pos: new THREE.Vector2(0.5, 0.5), time: -10 }
    ]
    this.nextRippleIndex = 0
    
    this.init(imageSrc)
  }
  
  async init(imageSrc) {
    this.containerDiv = document.createElement('div')
    this.containerDiv.style.position = 'relative'
    this.containerDiv.style.width = `${this.width}px`
    this.containerDiv.style.height = `${this.height}px`
    this.container.appendChild(this.containerDiv)
    
    this.bgImg = document.createElement('img')
    this.bgImg.src = imageSrc
    this.bgImg.style.position = 'absolute'
    this.bgImg.style.top = '0'
    this.bgImg.style.left = '0'
    this.bgImg.style.width = '100%'
    this.bgImg.style.height = '100%'
    this.bgImg.style.pointerEvents = 'none'
    this.bgImg.style.zIndex = '1'
    this.containerDiv.appendChild(this.bgImg)
    
    this.scene = new THREE.Scene()
    
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10)
    this.camera.position.z = 1
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.domElement.style.position = 'absolute'
    this.renderer.domElement.style.top = '0'
    this.renderer.domElement.style.left = '0'
    this.renderer.domElement.style.zIndex = '2'
    this.containerDiv.appendChild(this.renderer.domElement)
    
    const texture = await this.loadSVGAsTexture(imageSrc)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    
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
    
    const geometry = new THREE.PlaneGeometry(1, 1)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
    
    this.addEventListeners()
    
    this.animate()
  }
  
  loadSVGAsTexture(src) {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = this.width * 3
        canvas.height = this.height * 3
        const ctx = canvas.getContext('2d')
        
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
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
      const clickX = (e.clientX - rect.left) / rect.width
      const clickY = 1 - (e.clientY - rect.top) / rect.height
      
      const ripple = this.ripples[this.nextRippleIndex]
      ripple.pos.x = clickX
      ripple.pos.y = clickY
      ripple.time = performance.now() * 0.001
      
      this.material.uniforms[`uClickPos${this.nextRippleIndex}`].value.copy(ripple.pos)
      this.material.uniforms[`uClickTime${this.nextRippleIndex}`].value = ripple.time
      
      this.nextRippleIndex = (this.nextRippleIndex + 1) % 3
    })
    
    canvas.style.cursor = 'pointer'
  }
  
  animate() {
    requestAnimationFrame(() => this.animate())
    
    this.material.uniforms.uTime.value = performance.now() * 0.001
    
    this.renderer.render(this.scene, this.camera)
  }
  
  dispose() {
    this.containerDiv?.parentNode?.removeChild(this.containerDiv)
    this.renderer.dispose()
    this.material.dispose()
  }
}

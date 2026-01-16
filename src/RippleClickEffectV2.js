import * as THREE from 'three'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uPixelSize;
  uniform float uScale;
  uniform float uDensity;
  uniform float uRippleSpeed;
  uniform float uRippleThickness;
  uniform float uRippleIntensity;

  const int MAX_CLICKS = 10;
  uniform vec2 uClickPos[MAX_CLICKS];
  uniform float uClickTimes[MAX_CLICKS];

  varying vec2 vUv;

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


  void main() {
    vec2 uv = vUv;

    // Sample original texture
    vec4 texColor = texture2D(uTexture, uv);
    float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

    // Calculate burst effect only in click areas
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

    // Calculate ripple bursts from clicks
    float burstIntensity = 0.0;
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
      burstIntensity = max(burstIntensity, ring * atten * uRippleIntensity);
    }

    // Only apply burst effect where there's burst intensity
    if (burstIntensity > 0.01) {
      bool isLetter = texColor.a > 0.5;

      // Always use burst intensity for feed
      feed = burstIntensity;

      float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
      float bw = step(0.5, feed + bayer);

      float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
      float jitterScale = 1.0 + (h - 0.5) * 0.0;
      float coverage = bw * jitterScale;

      // White dots on letters, black dots on background
      vec3 burstColor = isLetter ? vec3(1.0) : vec3(0.0);

      // Render square dots with full opacity
      if (coverage > 0.01) {
        gl_FragColor = vec4(burstColor, coverage);
      } else {
        // Show original image underneath
        gl_FragColor = texColor;
      }
    } else {
      // No burst, show original image
      gl_FragColor = texColor;
    }
  }
`

const MAX_CLICKS = 10

export class RippleClickEffectV2 {
  constructor(container, imageSrc, width = 0, height = 0) {
    this.container = container
    this.width = width
    this.height = height
    this.disposed = false

    this.config = {
      pixelSize: 4.5,
      patternScale: 1,
      patternDensity: 1,
      rippleIntensityScale: 1,
      rippleThickness: 0.1,
      rippleSpeed: 0.6,
      speed: 0.75
    }

    this.init(imageSrc)
  }

  async init(imageSrc) {
    this.currentImageSrc = imageSrc

    // Сначала загружаем изображение чтобы узнать его aspect ratio
    const img = await this.loadImage(imageSrc)
    this.imageAspect = img.width / img.height

    this.containerDiv = document.createElement('div')
    this.containerDiv.style.position = 'relative'
    this.containerDiv.style.width = '100%'
    this.containerDiv.style.height = 'auto'
    this.containerDiv.style.opacity = '0' // Скрываем контейнер до полной загрузки
    this.containerDiv.style.transition = 'opacity 0.3s ease'
    this.container.appendChild(this.containerDiv)

    // Создаём background image чтобы определить высоту
    this.bgImg = document.createElement('img')
    this.bgImg.src = imageSrc
    this.bgImg.style.width = '100%'
    this.bgImg.style.height = 'auto'
    this.bgImg.style.display = 'block'
    this.bgImg.style.visibility = 'hidden' // Скрываем, но оставляем в потоке
    this.bgImg.onload = () => {
      // Когда изображение загрузится, обновляем размеры renderer
      this.updateDimensions()
    }
    this.containerDiv.appendChild(this.bgImg)

    // Создаём видимый background image для показа оригинала
    this.visibleBgImg = document.createElement('img')
    this.visibleBgImg.src = imageSrc
    this.visibleBgImg.style.position = 'absolute'
    this.visibleBgImg.style.top = '0'
    this.visibleBgImg.style.left = '0'
    this.visibleBgImg.style.width = '100%'
    this.visibleBgImg.style.height = '100%'
    this.visibleBgImg.style.pointerEvents = 'none'
    this.visibleBgImg.style.zIndex = '1'
    this.containerDiv.appendChild(this.visibleBgImg)

    this.scene = new THREE.Scene()

    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10)
    this.camera.position.z = 1

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.domElement.style.position = 'absolute'
    this.renderer.domElement.style.top = '0'
    this.renderer.domElement.style.left = '0'
    this.renderer.domElement.style.zIndex = '2'
    this.containerDiv.appendChild(this.renderer.domElement)

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
        uPixelSize: { value: this.config.pixelSize * this.renderer.getPixelRatio() },
        uScale: { value: this.config.patternScale },
        uDensity: { value: this.config.patternDensity },
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
    this.boundOnResize = () => this.onResize()
    window.addEventListener('resize', this.boundOnResize)
    this.animate()

    // Показываем контейнер плавно после полной загрузки
    requestAnimationFrame(() => {
      this.containerDiv.style.opacity = '1'
    })
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  updateDimensions() {
    const rect = this.bgImg.getBoundingClientRect()

    this.width = rect.width
    this.height = rect.height

    this.renderer.setSize(this.width, this.height)

    if (this.material) {
      this.material.uniforms.uResolution.value.set(
        this.renderer.domElement.width,
        this.renderer.domElement.height
      )
    }
  }

  onResize() {
    this.updateDimensions()
  }

  loadSVGAsTexture(src) {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        // Используем текущие размеры эффекта (или оригинальные размеры изображения)
        const textureWidth = this.width > 0 ? this.width : img.width
        const textureHeight = this.height > 0 ? this.height : img.height

        // Увеличиваем разрешение текстуры в 2 раза для лучшего качества
        const canvas = document.createElement('canvas')
        canvas.width = textureWidth * 6  // было * 3, теперь * 6 (в 2 раза больше)
        canvas.height = textureHeight * 6  // было * 3, теперь * 6 (в 2 раза больше)
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

  async updateImage(newImageSrc) {
    if (this.currentImageSrc === newImageSrc) return

    this.currentImageSrc = newImageSrc
    this.bgImg.src = newImageSrc
    this.visibleBgImg.src = newImageSrc

    // Обновляем aspect ratio
    const img = await this.loadImage(newImageSrc)
    this.imageAspect = img.width / img.height

    const texture = await this.loadSVGAsTexture(newImageSrc)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    if (this.material) {
      const oldTexture = this.material.uniforms.uTexture.value
      this.material.uniforms.uTexture.value = texture
      oldTexture?.dispose()
    }

    // Обновляем размеры после загрузки новой картинки
    setTimeout(() => this.updateDimensions(), 100)
  }

  resize(width, height) {
    this.width = width
    this.height = height

    this.containerDiv.style.width = `${width}px`
    this.containerDiv.style.height = `${height}px`

    this.renderer.setSize(width, height)

    if (this.material) {
      this.material.uniforms.uResolution.value.set(
        this.renderer.domElement.width,
        this.renderer.domElement.height
      )
    }

    // Перезагружаем текстуру с новыми размерами
    this.loadSVGAsTexture(this.currentImageSrc).then((texture) => {
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter

      if (this.material) {
        const oldTexture = this.material.uniforms.uTexture.value
        this.material.uniforms.uTexture.value = texture
        oldTexture?.dispose()
      }
    })
  }

  dispose() {
    this.disposed = true

    if (this.boundOnResize) {
      window.removeEventListener('resize', this.boundOnResize)
    }

    if (this.containerDiv?.parentNode) {
      this.containerDiv.parentNode.removeChild(this.containerDiv)
    }

    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.material.dispose()
    }

    if (this.renderer) {
      this.renderer.dispose()
    }

    if (this.scene) this.scene.clear()
  }
}

# Интеграция Coin Pixel Blast Effect в Webflow

Эта инструкция поможет вам интегрировать 3D шейдер эффект с монетой ETH и пиксельным фоном в ваш Webflow проект.

## Обзор

**CoinPixelBlastEffect** создаёт sophisticated визуальный эффект:
- **3D монета Ethereum** с дизерингом (пиксельным shading)
- **Пиксельный фон** с анимированными частицами
- **Интерактивные волны** при кликах на canvas
- **Прожекторное освещение** проявляет монету
- **Полностью адаптивный** дизайн

## Требуемые файлы

Для работы эффекта вам понадобятся:

1. **CoinPixelBlastEffect.js** - главный JavaScript файл с классом эффекта
2. **eth-coin.glb.txt** - 3D модель монеты в GLB формате
3. **Three.js библиотека** - v0.182.0 или новее
4. **GLTFLoader** - загрузчик 3D моделей из three.js examples

## Способ интеграции через CDN (Рекомендуется для Webflow)

### Шаг 1: Подключите библиотеки Three.js

В Webflow:
1. Откройте **Project Settings** → **Custom Code**
2. В секцию **Head Code** добавьте:

```html
<!-- Three.js через CDN -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"
  }
}
</script>
```

### Шаг 2: Загрузите файлы на хостинг

Загрузите следующие файлы на ваш хостинг или CDN:

```
/your-assets/
├── CoinPixelBlastEffect.js
└── eth-coin.glb.txt
```

**Важно:** Убедитесь, что:
- Файлы доступны через HTTPS
- CORS правильно настроен на сервере
- Файл `.glb.txt` отдается как binary или с правильным MIME типом

### Шаг 3: Загрузите 3D модель в Webflow

1. В Webflow откройте **Asset Panel**
2. Загрузите файл `eth-coin.glb.txt`
3. Скопируйте URL загруженного файла (будет доступен после публикации)
4. Используйте этот URL в коде эффекта

### Шаг 4: Добавьте контейнер для эффекта

В Webflow Designer:

1. Добавьте **Embed Code element** на страницу
2. Вставьте код контейнера:

```html
<div id="coin-effect" style="width: 100%; height: 100vh; position: relative;"></div>
```

3. Настройте размеры:
   - Для full-screen эффекта: `height: 100vh`
   - Для фиксированной высоты: `height: 600px` (или любое значение)
   - Для адаптивной ширины: `width: 100%` (уже установлено)

### Шаг 5: Инициализируйте эффект

В секции **Before `</body>` tag** в Custom Code добавьте:

```html
<script type="module">
  import { CoinPixelBlastEffect } from 'https://your-cdn.com/CoinPixelBlastEffect.js';

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('coin-effect');

    if (container) {
      // Создаём эффект
      const coinEffect = new CoinPixelBlastEffect(
        container,
        null, // svgPath (не используется)
        container.clientWidth,
        container.clientHeight
      );

      // Сохраняем ссылку для возможного использования
      window.coinEffect = coinEffect;
    }
  });

  // Очистка при уходе со страницы
  window.addEventListener('beforeunload', () => {
    if (window.coinEffect) {
      window.coinEffect.dispose();
    }
  });
</script>
```

### Шаг 6: Обновите конфигурацию (опционально)

После создания эффекта вы можете изменить его параметры:

```javascript
// Настройки эффекта
coinEffect.config = {
  variant: 'square',            // Форма пикселей: 'square', 'circle', 'triangle', 'diamond'
  pixelSize: 4,                 // Размер пикселей (1-10)
  color: '#ffffff',             // Цвет пикселей
  patternScale: 3,              // Масштаб паттерна (0.5-3)
  patternDensity: 1,            // Плотность частиц (0.1-2)
  pixelSizeJitter: 0,           // Вариация размера пикселей
  enableRipples: true,          // Включить ripple при клике
  rippleIntensityScale: 1,      // Интенсивность ripple (0.1-3)
  rippleThickness: 0.1,         // Толщина волны (0.05-0.5)
  rippleSpeed: 0.4,             // Скорость волны (0.1-2)
  speed: 0.2,                   // Общая скорость анимации (0.1-2)
  edgeFade: 0                   // Затемнение краёв (0-1)
};

// Применить изменения к шейдеру
coinEffect.bgMaterial.uniforms.uPixelSize.value = coinEffect.config.pixelSize * window.devicePixelRatio;
coinEffect.bgMaterial.uniforms.uScale.value = coinEffect.config.patternScale;
coinEffect.bgMaterial.uniforms.uDensity.value = coinEffect.config.patternDensity;
coinEffect.bgMaterial.uniforms.uRippleSpeed.value = coinEffect.config.rippleSpeed;
coinEffect.bgMaterial.uniforms.uRippleThickness.value = coinEffect.config.rippleThickness;
coinEffect.bgMaterial.uniforms.uRippleIntensity.value = coinEffect.config.rippleIntensityScale;
coinEffect.bgMaterial.uniforms.uShapeType.value = 0; // 0=square, 1=circle, 2=triangle, 3=diamond
```

## Примеры использования

### Пример 1: Hero секция с монетой

```html
<!-- В Webflow Embed Code -->
<div class="hero-section">
  <div id="hero-coin" style="width: 100%; height: 80vh; display: flex; align-items: center; justify-content: center; background: #000;"></div>
</div>

<script type="module">
  import { CoinPixelBlastEffect } from 'https://your-cdn.com/CoinPixelBlastEffect.js';

  const container = document.getElementById('hero-coin');
  const effect = new CoinPixelBlastEffect(
    container,
    null,
    container.clientWidth,
    container.clientHeight
  );

  // Настройки для hero секции
  effect.config.pixelSize = 5;
  effect.config.rippleIntensityScale = 1.5;
  effect.config.rippleSpeed = 0.5;
</script>
```

### Пример 2: Адаптивный контейнер

```html
<style>
  .responsive-coin {
    width: 100%;
    height: 0;
    padding-bottom: 100%; /* 1:1 aspect ratio */
    position: relative;
  }

  .responsive-coin > div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>

<div class="responsive-coin">
  <div id="adaptive-coin"></div>
</div>

<script type="module">
  import { CoinPixelBlastEffect } from 'https://your-cdn.com/CoinPixelBlastEffect.js';

  const container = document.getElementById('adaptive-coin');
  const effect = new CoinPixelBlastEffect(
    container,
    null,
    container.offsetWidth,
    container.offsetHeight
  );

  // Эффект автоматически адаптируется при resize
</script>
```

### Пример 3: Кастомные цвета и форма

```html
<script type="module">
  import { CoinPixelBlastEffect } from 'https://your-cdn.com/CoinPixelBlastEffect.js';

  const container = document.getElementById('coin-effect');
  const effect = new CoinPixelBlastEffect(container, null, 600, 600);

  // Круглые пиксели изумрудного цвета
  effect.config.variant = 'circle';
  effect.config.color = '#00ff88';
  effect.config.pixelSize = 6;
  effect.config.patternScale = 2;

  // Применяем настройки
  effect.bgMaterial.uniforms.uPixelSize.value = 6 * window.devicePixelRatio;
  effect.bgMaterial.uniforms.uScale.value = 2;
  effect.bgMaterial.uniforms.uShapeType.value = 1; // circle
  effect.bgMaterial.uniforms.uColor.value.set('#00ff88');
</script>
```

---

## Конфигурация и кастомизация

### Параметры конфигурации

| Параметр | Диапазон | Описание | Рекомендации |
|----------|----------|----------|--------------|
| `variant` | string | Форма пикселей | 'square', 'circle', 'triangle', 'diamond' |
| `pixelSize` | 1-10 | Размер пикселей | 4-6 для баланса, 2-3 для детализации |
| `color` | hex | Цвет пикселей | Любой HEX цвет |
| `patternScale` | 0.5-3 | Масштаб паттерна | 0.5-1 для мелких деталей, 2-3 для крупных |
| `patternDensity` | 0.1-2 | Плотность частиц | 0.5-1 для разреженного, 1.5-2 для плотного |
| `pixelSizeJitter` | 0-1 | Вариация размера | 0 для однородных, 0.3-0.5 для разнообразия |
| `enableRipples` | boolean | Включить ripple | true для интерактива, false для статического |
| `rippleIntensityScale` | 0.1-3 | Интенсивность волны | 0.5-1 для тонкого, 1.5-3 для яркого |
| `rippleThickness` | 0.05-0.5 | Толщина волны | 0.1-0.2 для резкой, 0.3-0.5 для мягкой |
| `rippleSpeed` | 0.1-2 | Скорость волны | 0.3-0.6 для медленного, 1-2 для быстрого |
| `speed` | 0.1-2 | Общая скорость | 0.5-1 для медленного, 1.5-2 для быстрого |
| `edgeFade` | 0-1 | Затемнение краёв | 0.1-0.3 для мягкого перехода |

### Настройка положения монеты

Измените в файле `CoinPixelBlastEffect.js` (строки 551-556):

```javascript
// Положение (x, y, z)
gltf.scene.position.set(0.66, -0.66, 3)

// Вращение (в радианах)
gltf.scene.rotation.x = Math.PI * 1.35
gltf.scene.rotation.y = Math.PI * 1.1
gltf.scene.rotation.z = Math.PI * 0.2

// Масштаб
const targetSize = 1.5  // Измените для размера монеты
const scale = targetSize / maxDim
gltf.scene.scale.setScalar(scale)
```

### Настройка освещения

Измените в методе `createLights()` (строки 505-526):

```javascript
// Прожектор (создаёт эффект проявления)
this.spotLight = new THREE.SpotLight(0xffffff, 8)
this.spotLight.position.set(0.66, -0.66, -1)
this.spotLight.target.position.set(0.5, -2, 3)
this.spotLight.angle = Math.PI / 60  // Ширина луча
this.spotLight.penumbra = 0.5        // Мягкость краёв

// Ambient свет
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)

// Направленный свет
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(0, 4, 2)
```

### Настройка дизеринга монеты

Измените в методе `loadCoin()` (строки 564-577):

```javascript
u_pxSize: 6,                    // Размер пикселя для дизеринга
u_roughness: 0.4,               // Шероховатость поверхности (0-1)
u_colorBack: [0, 0, 0, 1],      // Фоновый цвет (RGBA)
u_colorFront: [1, 1, 1, 1],     // Передний цвет (RGBA)
u_lightIntensity: 0.43,         // Интенсивность основного света
u_ambientLight: [0.4, 0.4, 0.4] // Цвет ambient света
```

---

## Производительность и оптимизация

### Оптимизация для мобильных устройств

```javascript
// Уменьшите pixel ratio для лучшей производительности
// В методе init(), строка ~419:
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1)); // Вместо 2
```

### Ограничение количества одновременных ripple

```javascript
// Уменьшите MAX_CLICKS если нужно меньше волн
const MAX_CLICKS = 5; // Вместо 10 (строка ~368)
```

### Отключение эффектов для производительности

```javascript
// Для слабых устройств
effect.config.enableRipples = false;      // Отключить ripple
effect.config.pixelSize = 8;              // Большие пиксели
effect.config.patternScale = 1;           // Простой паттерн
effect.config.speed = 0.1;                // Медленная анимация
```

---

## Troubleshooting

### Проблема: Модель не загружается

**Возможные причины:**
- Неверный путь к модели
- CORS ограничения
- Модель слишком большого размера

**Решения:**

1. Проверьте консоль браузера (F12 → Console)
2. Убедитесь, что модель доступна по прямой ссылке
3. Настройте CORS заголовки на сервере
4. Попробуйте модель меньшего размера (до 1MB)

```javascript
// Добавьте обработку ошибок загрузки
// В методе loadCoin(), замените error callback на:
(error) => {
  console.error('Error loading coin:', error);
  console.error('Make sure eth-coin.glb.txt is uploaded to Webflow assets');
}
```

### Проблема: Эффект не работает при клике

**Проверьте:**

1. Контейнер имеет корректные размеры:
```javascript
console.log('Container size:', container.clientWidth, container.clientHeight);
```

2. Canvas перекрывается другими элементами:
```css
/* Добавьте в Webflow */
#coin-effect canvas {
  pointer-events: auto !important;
  z-index: 10;
}
```

3. Событие клика привязано:
```javascript
// В консоли:
console.log('Canvas element:', effect.renderer.domElement);
console.log('Click listener attached:', effect.renderer.domElement.onclick);
```

### Проблема: Эффект работает медленно

**Решения:**

1. Уменьшите размер модели (оптимизируйте в Blender)
2. Уменьшите pixel ratio:
```javascript
effect.renderer.setPixelRatio(1);
```
3. Увеличьте `pixelSize` до 6-8
4. Уменьшите количество волн (MAX_CLICKS)
5. Отключите ripple: `enableRipples: false`

### Проблема: Чёрный экран

**Причины:**
- Three.js не загрузился
- Ошибка в JavaScript
- Нулевой размер контейнера

**Решения:**

1. Проверьте консоль на ошибки
2. Убедитесь, что контейнер имеет высоту:
```css
#coin-effect {
  height: 100vh; /* или фиксированное значение */
}
```
3. Проверьте загрузку Three.js (вкладка Network в DevTools)

### Проблема: Монета отображается некорректно

**Решения:**

1. Проверьте путь к модели в коде
2. Убедитесь, что модель в формате GLB
3. Проверьте масштаб модели:
```javascript
// В loadCoin(), попробуйте изменить targetSize
const targetSize = 1.0;  // Меньше
// или
const targetSize = 2.0;  // Больше
```

---

## Полный пример интеграции

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"
      }
    }
  </script>

  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000;
    }

    .coin-container {
      width: 100%;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .instruction {
      position: absolute;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-family: Arial, sans-serif;
      font-size: 14px;
      opacity: 0.7;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="coin-container">
    <div id="coin-effect"></div>
    <div class="instruction">Кликните в любом месте для создания волны</div>
  </div>

  <script type="module">
    import { CoinPixelBlastEffect } from './CoinPixelBlastEffect.js';

    const container = document.getElementById('coin-effect');

    const effect = new CoinPixelBlastEffect(
      container,
      null,
      container.clientWidth,
      container.clientHeight
    );

    // Кастомизация
    effect.config.pixelSize = 5;
    effect.config.variant = 'circle';
    effect.config.color = '#627eea'; // Ethereum blue
    effect.config.rippleIntensityScale = 1.2;
    effect.config.rippleSpeed = 0.5;

    // Применяем настройки
    effect.bgMaterial.uniforms.uPixelSize.value =
      effect.config.pixelSize * window.devicePixelRatio;
    effect.bgMaterial.uniforms.uScale.value = effect.config.patternScale;
    effect.bgMaterial.uniforms.uDensity.value = effect.config.patternDensity;
    effect.bgMaterial.uniforms.uRippleSpeed.value = effect.config.rippleSpeed;
    effect.bgMaterial.uniforms.uRippleThickness.value = effect.config.rippleThickness;
    effect.bgMaterial.uniforms.uRippleIntensity.value = effect.config.rippleIntensityScale;
    effect.bgMaterial.uniforms.uShapeType.value = 1; // circle
    effect.bgMaterial.uniforms.uColor.value.set('#627eea');

    // Очистка
    window.addEventListener('beforeunload', () => {
      effect.dispose();
    });
  </script>
</body>
</html>
```

---

## Дополнительные возможности

### Программный вызов ripple эффекта

```javascript
// Создать ripple в определённой точке (в пикселях)
function createRipple(pixelX, pixelY) {
  const uniforms = effect.bgMaterial.uniforms;
  const canvas = effect.renderer.domElement;

  uniforms.uClickPos.value[effect.clickIndex].set(pixelX, pixelY);
  uniforms.uClickTimes.value[effect.clickIndex] = uniforms.uTime.value;
  effect.clickIndex = (effect.clickIndex + 1) % 10;
}

// Пример: ripple в центре
const canvas = effect.renderer.domElement;
createRipple(canvas.width / 2, canvas.height / 2);

// Пример: ripple в случайном месте
setInterval(() => {
  const canvas = effect.renderer.domElement;
  createRipple(
    Math.random() * canvas.width,
    Math.random() * canvas.height
  );
}, 2000);
```

### Изменение поведения при клике

Эффект использует событие `pointerdown`. Вы можете изменить это:

```javascript
// В методе setupMouseInteraction() замените:
canvas.addEventListener('pointerdown', (e) => { ... })

// На:
canvas.addEventListener('mousedown', (e) => { ... }) // Только мышь
// Или:
canvas.addEventListener('touchstart', (e) => { ... }) // Только тач
```

### Анимация монеты

```javascript
// Изменить амплитуду вращения монеты
// В методе animate(), строка ~673-676:
const maxRotation = 30 * Math.PI / 180;  // Увеличить амплитуду
const rotationSpeed = 1.5;               // Увеличить скорость
const rotationAngle = Math.sin(elapsed * rotationSpeed) * maxRotation;
this.coin.rotation.z = rotationAngle;
```

---

## Подготовка 3D модели

### Требования к модели

1. **Формат:** GLB (GL Binary)
2. **Рекомендуемый размер:** До 1MB
3. **Оптимизация:** Минимальное количество полигонов
4. **Материалы:** Applied材质 в Blender

### Оптимизация в Blender

```python
# Blender Python script для оптимизации
import bpy

# Удалить лишние объекты
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.ops.object.delete()

# Применить модификатор Decimate для уменьшения полигонов
decimate = obj.modifiers.new(name='Decimate', type='DECIMATE')
decimate.ratio = 0.5  # Сохранить 50% полигонов

# Экспорт в GLB
bpy.ops.export_scene.gltf(
    filepath='model.glb',
    export_selected=True,
    export_format='GLB'
)
```

### Конвертация в .txt

После экспорта:
1. Переименуйте `model.glb` в `model.glb.txt`
2. Загрузите в Webflow через Asset Panel

---

## Ресурсы

- [Three.js Documentation](https://threejs.org/docs/)
- [GLTFLoader Documentation](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)
- [WebGL Shader Techniques](https://webgl-shaders.com/)
- [Webflow Custom Code Guide](https://university.webflow.com/lesson/code-custom-code)
- [Blender GLTF Export](https://docs.blender.org/manual/en/latest/addons/io_scene_gltf.html)
- [CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

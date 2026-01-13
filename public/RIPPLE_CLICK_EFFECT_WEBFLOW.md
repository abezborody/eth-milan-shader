# Интеграция Ripple Click Effect V2 в Webflow

Эта инструкция поможет вам интегрировать интерактивный ripple эффект с пиксельными взрывами в ваш Webflow проект.

## Обзор

**RippleClickEffectV2** создаёт эффект пиксельных волн при кликах на изображении:
- **Клик по изображению** → Пиксельная волна расходится от точки клика
- **Оригинальное изображение** отображается под эффектом
- **Пиксельные частицы** образуют круговые паттерны
- **Автоматическое угасание** эффекта со временем

## Требуемые файлы

Для работы эффекта вам понадобятся:

1. **RippleClickEffectV2.js** - главный JavaScript файл с классом эффекта
2. **Three.js библиотека** - v0.182.0 или новее
3. **Изображение** - любой формат (PNG/JPG/SVG) с прозрачностью

## Способ интеграции через CDN (Рекомендуется для Webflow)

### Шаг 1: Подключите библиотеку Three.js

В Webflow:
1. Откройте **Project Settings** → **Custom Code**
2. В секцию **Head Code** добавьте:

```html
<!-- Three.js через CDN -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js"
  }
}
</script>
```

### Шаг 2: Загрузите файл эффекта

Загрузите **RippleClickEffectV2.js** на ваш хостинг или CDN:

```
https://your-cdn.com/RippleClickEffectV2.js
```

**Важно:** Убедитесь, что:
- Файл доступен через HTTPS
- CORS правильно настроен на сервере
- Файл отдается с правильным MIME типом (`text/javascript` или `application/javascript`)

### Шаг 3: Добавьте контейнер для эффекта

В Webflow Designer:

1. Добавьте **Embed Code element** на страницу
2. Вставьте код контейнера:

```html
<div id="ripple-effect" style="width: 100%; height: 100vh; position: relative;"></div>
```

3. Настройте размеры:
   - Для full-screen эффекта: `height: 100vh`
   - Для фиксированной высоты: `height: 600px` (или любое значение)
   - Для адаптивной ширины: `width: 100%` (уже установлено)

### Шаг 4: Инициализируйте эффект

В секции **Before `</body>` tag** в Custom Code добавьте:

```html
<script type="module">
  import { RippleClickEffectV2 } from 'https://your-cdn.com/RippleClickEffectV2.js';

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('ripple-effect');

    if (container) {
      // Измените на URL вашего изображения
      const imageUrl = 'https://your-cdn.com/your-image.png';

      // Создаём эффект
      const rippleEffect = new RippleClickEffectV2(
        container,
        imageUrl,
        container.clientWidth,
        container.clientHeight
      );

      // Сохраняем ссылку для возможного использования
      window.rippleEffect = rippleEffect;
    }
  });

  // Очистка при уходе со страницы
  window.addEventListener('beforeunload', () => {
    if (window.rippleEffect) {
      window.rippleEffect.dispose();
    }
  });
</script>
```

### Шаг 5: Обновите конфигурацию (опционально)

После создания эффекта вы можете изменить его параметры:

```javascript
// Настройки эффекта
rippleEffect.config = {
  pixelSize: 4.5,              // Размер пикселей (1-10)
  patternScale: 1,             // Масштаб паттерна (0.5-3)
  patternDensity: 1,           // Плотность частиц (0.1-2)
  rippleIntensityScale: 1,     // Интенсивность ripple (0.1-3)
  rippleThickness: 0.1,        // Толщина волны (0.05-0.5)
  rippleSpeed: 0.6,            // Скорость волны (0.1-2)
  speed: 0.75                  // Общая скорость анимации (0.1-2)
};

// Применить изменения к шейдеру
rippleEffect.material.uniforms.uPixelSize.value = rippleEffect.config.pixelSize * window.devicePixelRatio;
rippleEffect.material.uniforms.uScale.value = rippleEffect.config.patternScale;
rippleEffect.material.uniforms.uDensity.value = rippleEffect.config.patternDensity;
rippleEffect.material.uniforms.uRippleSpeed.value = rippleEffect.config.rippleSpeed;
rippleEffect.material.uniforms.uRippleThickness.value = rippleEffect.config.rippleThickness;
rippleEffect.material.uniforms.uRippleIntensity.value = rippleEffect.config.rippleIntensityScale;
```

## Примеры использования

### Пример 1: Hero секция с логотипом

```html
<!-- В Webflow Embed Code -->
<div class="hero-section">
  <div id="logo-ripple" style="width: 100%; height: 80vh; display: flex; align-items: center; justify-content: center; background: #000;"></div>
</div>

<script type="module">
  import { RippleClickEffectV2 } from 'https://your-cdn.com/RippleClickEffectV2.js';

  const container = document.getElementById('logo-ripple');
  const effect = new RippleClickEffectV2(
    container,
    '/assets/logo-white.png', // Путь к логотипу
    container.clientWidth,
    container.clientHeight
  );

  // Настройки для белого логотипа на черном фоне
  effect.config.rippleIntensityScale = 1.5;
  effect.config.rippleSpeed = 0.8;
</script>
```

### Пример 2: Адаптивный контейнер

```html
<style>
  .responsive-ripple {
    width: 100%;
    height: 0;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    position: relative;
  }

  .responsive-ripple > div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>

<div class="responsive-ripple">
  <div id="adaptive-ripple"></div>
</div>

<script type="module">
  import { RippleClickEffectV2 } from 'https://your-cdn.com/RippleClickEffectV2.js';

  const container = document.getElementById('adaptive-ripple');
  const effect = new RippleClickEffectV2(
    container,
    '/assets/interactive-image.png',
    container.offsetWidth,
    container.offsetHeight
  );

  // Обработка изменения размера
  window.addEventListener('resize', () => {
    // Эффект автоматически адаптируется при resize
  });
</script>
```

### Пример 3: Несколько эффектов на странице

```html
<div id="ripple-1" class="ripple-container"></div>
<div id="ripple-2" class="ripple-container"></div>

<script type="module">
  import { RippleClickEffectV2 } from 'https://your-cdn.com/RippleClickEffectV2.js';

  const effects = [];

  // Создаём первый эффект
  const container1 = document.getElementById('ripple-1');
  effects.push(new RippleClickEffectV2(container1, '/image1.png', container1.clientWidth, container1.clientHeight));

  // Создаём второй эффект
  const container2 = document.getElementById('ripple-2');
  effects.push(new RippleClickEffectV2(container2, '/image2.png', container2.clientWidth, container2.clientHeight));

  // Очистка всех эффектов
  window.addEventListener('beforeunload', () => {
    effects.forEach(effect => effect.dispose());
  });
</script>
```

## Подготовка изображения

### Требования к изображению

1. **Формат:** PNG, JPG, SVG
2. **Рекомендуемый размер:** 1000-2000px по большей стороне
3. **Прозрачность:** PNG с прозрачностью для лучшего эффекта
4. **CORS:** Если изображение на другом домене - настройте CORS заголовки

### Оптимизация для Web

```bash
# Оптимизация PNG (используя ImageMagick)
convert input.png -resize 1500x1500 -quality 95 output.png

# Оптимизация JPG
convert input.jpg -resize 1500x1500 -quality 85 output.jpg
```

---

## Конфигурация и кастомизация

### Параметры конфигурации

| Параметр | Диапазон | Описание | Рекомендации |
|----------|----------|----------|--------------|
| `pixelSize` | 1-10 | Размер пикселей | 4-6 для баланса, 2-3 для детализации |
| `patternScale` | 0.5-3 | Масштаб паттерна | 0.5-1 для мелких деталей, 2-3 для крупных |
| `patternDensity` | 0.1-2 | Плотность частиц | 0.5-1 для разреженного, 1.5-2 для плотного |
| `rippleIntensityScale` | 0.1-3 | Интенсивность волны | 0.5-1 для тонкого, 1.5-3 для яркого |
| `rippleThickness` | 0.05-0.5 | Толщина волны | 0.1-0.2 для резкой, 0.3-0.5 для мягкой |
| `rippleSpeed` | 0.1-2 | Скорость волны | 0.3-0.6 для медленного, 1-2 для быстрого |
| `speed` | 0.1-2 | Общая скорость | 0.5-1 для медленного, 1.5-2 для быстрого |

### Изменение поведения при клике

Эффект использует событие `click`. Вы можете изменить это:

```javascript
// В методе addEventListeners() замените:
canvas.addEventListener('click', (e) => { ... })

// На:
canvas.addEventListener('mousedown', (e) => { ... }) // Срабатывает быстрее
// Или:
canvas.addEventListener('mousemove', (e) => { ... }) // При движении мыши
```

---

## Производительность и оптимизация

### Оптимизация для мобильных устройств

```javascript
// Уменьшите pixel ratio для лучшей производительности
// В методе init(), строка 205:
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1)); // Вместо 2
```

### Ограничение количества одновременных эффектов

```javascript
// Уменьшите MAX_CLICKS если нужно меньше волн
const MAX_CLICKS = 5; // Вместо 10
```

### Отключение эффекта на мобильных

```html
<script type="module">
  import { RippleClickEffectV2 } from 'https://your-cdn.com/RippleClickEffectV2.js';

  const isMobile = window.innerWidth < 768;

  if (!isMobile) {
    const container = document.getElementById('ripple-effect');
    const effect = new RippleClickEffectV2(container, '/image.png', ...);
  }
</script>
```

## Troubleshooting

### Проблема: Изображение не загружается

**Возможные причины:**
- Неверный путь к изображению
- CORS ограничения
- Изображение слишком большого размера

**Решения:**

1. Проверьте консоль браузера (F12 → Console)
2. Убедитесь, что изображение доступно по прямой ссылке
3. Настройте CORS заголовки на сервере
4. Попробуйте smaller изображение

```javascript
// Добавьте обработку ошибок загрузки
const effect = new RippleClickEffectV2(container, imageUrl, width, height);

// Проверьте, загрузилась ли текстура
setTimeout(() => {
  console.log('Texture loaded:', effect.material.uniforms.uTexture.value.image);
}, 1000);
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
#ripple-effect canvas {
  pointer-events: auto !important;
  z-index: 10;
}
```

3. Событие клика привязано:
```javascript
// В консоли:
console.log('Canvas element:', effect.renderer.domElement);
```

### Проблема: Эффект работает медленно

**Решения:**

1. Уменьшите размер изображения (максимум 2000px)
2. Уменьшите pixel ratio:
```javascript
effect.renderer.setPixelRatio(1);
```
3. Уменьшите количество волн (MAX_CLICKS)
4. Упростите конфигурацию (меньше density)

### Проблема: Чёрный экран

**Причины:**
- Three.js не загрузился
- Ошибка в JavaScript
- Нулевой размер контейнера

**Решения:**

1. Проверьте консоль на ошибки
2. Убедитесь, что контейнер имеет высоту:
```css
#ripple-effect {
  height: 100vh; /* или фиксированное значение */
}
```
3. Проверьте загрузку Three.js (вкладка Network в DevTools)


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
      "three": "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js"
    }
  }
  </script>

  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000;
    }

    .ripple-container {
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
  <div class="ripple-container">
    <div id="ripple-effect"></div>
    <div class="instruction">Кликните в любом месте</div>
  </div>

  <script type="module">
    import { RippleClickEffectV2 } from './RippleClickEffectV2.js';

    const container = document.getElementById('ripple-effect');

    const effect = new RippleClickEffectV2(
      container,
      'https://your-cdn.com/logo.png',
      container.clientWidth,
      container.clientHeight
    );

    // Кастомизация
    effect.config.pixelSize = 5;
    effect.config.rippleIntensityScale = 1.2;
    effect.config.rippleSpeed = 0.7;

    // Применяем настройки
    effect.material.uniforms.uPixelSize.value =
      effect.config.pixelSize * window.devicePixelRatio;
    effect.material.uniforms.uRippleIntensity.value =
      effect.config.rippleIntensityScale;
    effect.material.uniforms.uRippleSpeed.value =
      effect.config.rippleSpeed;

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
// Создать ripple в определённой точке (0-1 диапазон)
function createRipple(x, y) {
  const uniforms = effect.material.uniforms;
  const canvas = effect.renderer.domElement;

  // Конвертируем из нормализованных координат в пиксели
  const pixelX = x * canvas.width;
  const pixelY = (1 - y) * canvas.height;

  uniforms.uClickPos.value[effect.clickIndex].set(pixelX, pixelY);
  uniforms.uClickTimes.value[effect.clickIndex] = uniforms.uTime.value;
  effect.clickIndex = (effect.clickIndex + 1) % 10;
}

// Пример: ripple в центре
createRipple(0.5, 0.5);

// Пример: ripple в случайном месте
setInterval(() => {
  createRipple(Math.random(), Math.random());
}, 2000);
```

## Ресурсы

- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL Shader Techniques](https://webgl-shaders.com/)
- [Webflow Custom Code Guide](https://university.webflow.com/lesson/code-custom-code)
- [CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)


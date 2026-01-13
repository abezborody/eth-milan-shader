# Интеграция Coin Pixel Blast Shader в Webflow

Эта инструкция поможет вам интегрировать 3D шейдер эффект с монетой ETH в ваш Webflow проект.

## Обзор

Шейдер состоит из:
- **Фон с пиксельным эффектом** (PixelBlast) - анимированные частицы реагируют на клики
- **3D модель монеты ETH** с дизерингом и прожекторным освещением
- **Интерактивность** - клики создают волны на фоне

## Требуемые файлы

Для работы шейдера вам понадобятся следующие файлы:

1. **CoinPixelBlastEffect.js** - главный JavaScript файл с классом шейдера
2. **ETH.fbx** - 3D модель монеты (должна быть доступна по пути `/ETH.fbx`)
3. **Three.js библиотека** - v0.182.0 или новее
4. **FBXLoader** - загрузчик 3D моделей из three.js examples

## Способ интеграции через CDN (Рекомендуется для Webflow)

### Шаг 1: Подключите библиотеки Three.js

В Webflow:
1. Откройте Project Settings → Custom Code
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
└── ETH.fbx
```

**Важно:** Убедитесь, что файлы доступны через HTTPS и CORS правильно настроен.

### Шаг 3: Создайте контейнер для шейдера

В Webflow designer:

1. Добавьте **Embed Code element** на страницу
2. Установите ему ID `shader-container` (или любое другое название)
3. Установите высоту контейнера (например, `100vh` или фиксированную высоту)

```html
<div id="shader-container" style="width: 100%; height: 100vh;"></div>
```

### Шаг 4: Добавьте код инициализации

В секции **Before `</body>` tag** в Custom Code добавьте:

```html
<script type="module">
  import { CoinPixelBlastEffect } from 'https://your-cdn.com/CoinPixelBlastEffect.js';

  // Инициализация шейдера
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('shader-container');

    if (container) {
      // Путь к FBX модели должен быть доступен
      const shader = new CoinPixelBlastEffect(
        container,
        null, // svgPath не используется в данном эффекте
        container.clientWidth,
        container.clientHeight
      );

      // Опционально: настройка конфигурации
      shader.config = {
        variant: 'square',        // square, circle, triangle, diamond
        pixelSize: 4,             // размер пикселей
        color: '#ffffff',         // цвет частиц
        patternScale: 3,          // масштаб паттерна
        patternDensity: 1,        // плотность частиц
        pixelSizeJitter: 0,       // вариация размера пикселей
        enableRipples: true,      // включить ripple эффект при клике
        rippleIntensityScale: 1,  // интенсивность ripple
        rippleThickness: 0.1,     // толщина ripple
        rippleSpeed: 0.4,         // скорость ripple
        speed: 0.2,               // общая скорость анимации
        edgeFade: 0               // затемнение краев (0-1)
      };
    }
  });

  // Очистка при уходе со страницы
  window.addEventListener('beforeunload', () => {
    if (window.shaderInstance) {
      window.shaderInstance.dispose();
    }
  });
</script>
```

### Шаг 5: Обновите пути к файлам

В **CoinPixelBlastEffect.js** измените строку 527:

```javascript
// Было:
loader.load('/ETH.fbx', ...)

// Станет (путь к вашему хостингу):
loader.load('https://your-cdn.com/ETH.fbx', ...)
```

## Дополнительные ресурсы

- [Three.js Documentation](https://threejs.org/docs/)
- [FBXLoader Documentation](https://threejs.org/docs/#examples/en/loaders/FBXLoader)
- [Webflow Custom Code Guide](https://university.webflow.com/lesson/code-custom-code)


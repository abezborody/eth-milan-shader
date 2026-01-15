# Интеграция Coin Pixel Blast Shader в Webflow

Эта инструкция поможет вам интегрировать 3D шейдер эффект с монетой ETH в ваш Webflow проект.

## Обзор

Шейдер состоит из:
- **Фон с пиксельным эффектом** (PixelBlast) - анимированные частицы реагируют на клики
- **3D модель монеты ETH** с дизерингом и прожекторным освещением
- **Интерактивность** - клики создают волны на фоне
- **Адаптивный дизайн** - шейдер автоматически подстраивается под размер экрана

## Требуемые файлы

Для работы шейдера вам понадобятся следующие файлы:

1. **CoinPixelBlastEffect.js** - главный JavaScript файл с классом шейдера
2. **eth-coin.glb.txt** - 3D модель монеты в GLB формате (должна быть доступна по пути `/eth-coin.glb.txt`)
3. **Three.js библиотека** - v0.182.0 или новее
4. **GLTFLoader** - загрузчик 3D моделей из three.js examples

**Важно:** Файл модели переименован в `.glb.txt` для удобной загрузки через файловый менеджер Webflow.

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
└── eth-coin.glb.txt
```

**Важно:**
- Убедитесь, что файлы доступны через HTTPS
- CORS должен быть правильно настроен
- Файл `.glb.txt` должен отдаваться с правильным MIME типом или загружаться как binary

### Шаг 3: Загрузите 3D модель в Webflow

1. В Webflow откройте Asset Panel
2. Загрузите файл `eth-coin.glb.txt`
3. Скопируйте URL загруженного файла (будет доступен после публикации)
4. Используйте этот URL в коде шейдера

### Шаг 4: Создайте контейнер для шейдера

В Webflow designer:

1. Добавьте **Embed Code element** на страницу
2. Установите ему ID `shader-container` (или любое другое название)
3. Установите высоту контейнера (например, `100vh` или фиксированную высоту)

```html
<div id="shader-container" style="width: 100%; height: 100vh;"></div>
```

### Шаг 5: Добавьте код инициализации

В секции **Before `</body>` tag** в Custom Code добавьте:

```html
<script type="module">
  import { CoinPixelBlastEffect } from 'https://your-cdn.com/CoinPixelBlastEffect.js';

  // Инициализация шейдера
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('shader-container');

    if (container) {
      // Путь к GLB модели должен быть доступен
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

### Шаг 6: Обновите пути к файлам

В **CoinPixelBlastEffect.js** измените строку 533:

```javascript
// Было (FBX):
loader.load('/ETH.fbx', ...)

// Станет (GLB, путь к Webflow assets):
loader.load('https://uploads-ssl.webflow.com/.../eth-coin.glb.txt', ...)
```

Или если используете свой CDN:

```javascript
loader.load('https://your-cdn.com/eth-coin.glb.txt', ...)
```

## Особенности GLB формата

Мы перешли с FBX на GLB формат по следующим причинам:

1. **Более компактный размер** - GLB обычно на 30-50% меньше FBX
2. **Лучшая web-совместимость** - GLB - это binary формат, оптимизированный для web
3. **Файл .glb.txt** - переименование позволяет загрузить модель через файловый менеджер Webflow
4. **Автоматическая обработка** - Three.js GLTFLoader корректно обрабатывает .glb.txt файлы

## Адаптивность

Шейдер автоматически подстраивается под размер экрана:

- **Камера**: Ортогональная камера автоматически изменяет aspect ratio
- **Фон**: Геометрия плоскости пересоздаётся при изменении размера
- **Шейдеры**: Uniform-переменные resolution обновляются в real-time
- **Пиксели**: Размер пикселей учитывает devicePixelRatio

Никакого искажения при изменении размера окна!

## Настройка положения монеты

Вы можете изменить положение и вращение монеты в файле **CoinPixelBlastEffect.js**:

```javascript
// Положение (x, y, z)
gltf.scene.position.set(0.66, -0.66, 3)

// Вращение (в радианах)
gltf.scene.rotation.x = Math.PI * 1.35
gltf.scene.rotation.y = Math.PI * 1.1
gltf.scene.rotation.z = Math.PI * 0.2

// Размер (targetSize = 1.5 для десктопа)
const scale = targetSize / maxDim
gltf.scene.scale.setScalar(scale)
```

## Дополнительные ресурсы

- [Three.js Documentation](https://threejs.org/docs/)
- [GLTFLoader Documentation](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)
- [Webflow Custom Code Guide](https://university.webflow.com/lesson/code-custom-code)
- [Подробный гайд по эффекту](./COIN_PIXEL_BLAST_EFFECT.md) - английская версия с примерами

## Troubleshooting

### Модель не загружается

1. Проверьте путь к файлу в консоли браузера
2. Убедитесь, что файл загружен в Webflow Assets
3. Проверьте, что сайт опубликован и URL доступен
4. Проверьте CORS настройки

### Шейдер искажён

1. Убедитесь, что контейнер имеет явные width/height
2. Проверьте консоль на наличие ошибок
3. Убедитесь, что resize listener работает

### Волны не работают

1. Проверьте, что `enableRipples: true`
2. Убедитесь, что pointer events не заблокированы CSS
3. Проверьте консоль браузера на ошибки

### Проблемы с производительностью

1. Увеличьте `pixelSize` до 6-8
2. Уменьшите `patternScale` до 2-3
3. Отключите ripple: `enableRipples: false`
4. Уменьшите `speed` до 0.1


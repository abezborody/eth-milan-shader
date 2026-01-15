# Coin Pixel Blast Effect - Гайд по интеграции в Webflow

## Обзор

Coin Pixel Blast Effect - это sophisticated WebGL шейдер-эффект, который сочетает в себе:
- 3D модель монеты Ethereum с шейдером дизеринга
- Динамический пиксельный фон с интерактивными волнами
- Эффекты прожектора, которые открывают монету
- Полностью адаптивный дизайн

## Демо

Полный код реализации см. в `src/CoinPixelBlastEffect.js`.

## Требуемые файлы

1. **Главный скрипт эффекта**: `src/CoinPixelBlastEffect.js`
2. **3D модель**: `public/eth-coin.glb.txt`
3. **Зависимости**: Three.js и GLTFLoader

## Шаги интеграции в Webflow

### 1. Загрузка файлов в Webflow

Загрузите эти файлы в Assets вашего Webflow проекта:

1. **Скомпилированный JavaScript** - Соберите проект и загрузите:
   - dist/assets/index-[hash].js
   - dist/assets/index-[hash].css

2. **3D модель** - Загрузите `public/eth-coin.glb.txt` в Webflow assets

### 2. Добавление HTML структуры

На вашей странице Webflow добавьте контейнер:

```html
<div id="coin-pixel-blast-container"></div>
```

Настройте стили с кастомными размерами:
- Ширина: 100% (или фиксированная, например 600px)
- Высота: 600px (или любая желаемая высота)

### 3. Инициализация эффекта

Добавьте этот скрипт перед закрывающим тегом `</body>`:

```html
<script>
  // Ждём загрузки основного скрипта
  document.addEventListener('DOMContentLoaded', function() {
    // Инициализация эффекта
    const container = document.getElementById('coin-pixel-blast-container');

    if (container && window.CoinPixelBlastEffect) {
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 600;

      const effect = new window.CoinPixelBlastEffect(
        container,
        null,  // svgPath (не используется для этого эффекта)
        width,
        height
      );
    }
  });
</script>
```

### 4. Обновление путей к файлам

После загрузки в Webflow обновите пути в скомпилированном JavaScript:

1. Найдите `/eth-coin.glb.txt` в вашем собранном JS файле
2. Замените на URL вашего файла в Webflow assets

### 5. Адаптивное поведение

Эффект автоматически адаптируется к изменениям размера экрана:
- **Камера**: Ортогональная камера настраивает aspect ratio для предотвращения искажений
- **Фон**: Геометрия плоскости изменяет размер под aspect ratio контейнера
- **Шейдеры**: Uniform-переменные resolution обновляются при ресайзе
- **Размер пикселей**: Настраивается на основе device pixel ratio

## Настройки конфигурации

Вы можете настроить эффект, изменив эти параметры в `CoinPixelBlastEffect.js`:

### Фоновый паттерн

```javascript
this.config = {
  variant: 'square',           // Форма: 'square', 'circle', 'triangle', 'diamond'
  pixelSize: 4,               // Размер пикселей (больше = более блокированный)
  color: '#fff',              // Цвет пикселей
  patternScale: 3,            // Масштаб шумового паттерна
  patternDensity: 1,          // Плотность паттерна (0-2)
  pixelSizeJitter: 0,         // Случайная вариация размера пикселей
  enableRipples: true,        // Включить ripple при клике
  rippleIntensityScale: 1,    // Интенсивность ripple
  rippleThickness: 0.1,       // Ширина ripple
  rippleSpeed: 0.4,          // Скорость расширения ripple
  speed: 0.2,                // Скорость анимации
  edgeFade: 0                // Затемнение краёв (0-1)
}
```

### Положение монеты

```javascript
// Позиция модели
gltf.scene.position.set(0.66, -0.66, 3)

// Вращение модели
gltf.scene.rotation.x = Math.PI * 1.35
gltf.scene.rotation.y = Math.PI * 1.1
gltf.scene.rotation.z = Math.PI * 0.2

// Масштаб (targetSize = 1.5)
const scale = targetSize / maxDim
gltf.scene.scale.setScalar(scale)
```

### Освещение

```javascript
// Прожектор (создаёт эффект проявления)
this.spotLight = new THREE.SpotLight(0xffffff, 8)
this.spotLight.position.set(0.66, -0.66, -1)
this.spotLight.target.position.set(0.5, -2, 3)
this.spotLight.angle = Math.PI / 60
this.spotLight.penumbra = 0.5

// Ambient свет
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)

// Направленный свет
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(0, 4, 2)
```

### Шейдер монеты (Дизеринг)

```javascript
// Настройки дизеринга монеты
u_pxSize: 6,                    // Размер пикселя для дизеринга
u_roughness: 0.4,               // Шероховатость поверхности (0-1)
u_colorBack: [0, 0, 0, 1],      // Фоновый цвет (RGBA)
u_colorFront: [1, 1, 1, 1],     // Передний цвет (RGBA)
u_lightIntensity: 0.43,         // Интенсивность основного света
u_ambientLight: [0.4, 0.4, 0.4] // Цвет ambient света
```

## Производительность

1. **Device Pixel Ratio**: Ограничен до 2x для предотвращения проблем с производительностью на high-DPI дисплеях
2. **Размер пикселей**: Большие размеры (6-8) более производительны
3. **Сложность модели**: GLB модель должна быть оптимизирована для web (до 1MB)
4. **Тени**: Отключены для лучшей производительности

## Поддержка браузеров

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Мобильные браузеры (iOS Safari 14+, Chrome Android)

Требуется поддержка WebGL.

## Устранение проблем

### Модель не загружается

1. Проверьте консоль на ошибки CORS
2. Проверьте путь к `eth-coin.glb.txt`
3. Убедитесь, что файл загружен в Webflow assets
4. Проверьте размер файла (должен быть до 5MB)

### Эффект выглядит искажённым

1. Убедитесь, что контейнер имеет явные width/height
2. Проверьте, что resize listener работает
3. Проверьте обновление aspect ratio камеры

### Ripple не работает

1. Проверьте, что `enableRipples` установлен в true
2. Убедитесь, что pointer events не заблокированы CSS
3. Проверьте консоль браузера на ошибки

### Проблемы с производительностью

1. Увеличьте `pixelSize` до 6-8
2. Уменьшите `patternScale` до 2-3
3. Отключите ripple: `enableRipples: false`
4. Уменьшите `speed` до 0.1

## Советы по настройке

### Изменить цвет пикселей

```javascript
this.config = {
  color: '#00ff88',  // Изумрудный зелёный
  // ... остальные настройки
}
```

### Настроить интенсивность ripple

```javascript
this.config = {
  rippleIntensityScale: 2,  // Более интенсивные ripple
  rippleThickness: 0.05,    // Более тонкие ripple
  // ... остальные настройки
}
```

### Изменить внешний вид монеты

```javascript
// В uniform переменных шейдера
u_colorFront: new THREE.Vector4(0.8, 0.6, 1.0, 1.0),  // Фиолетовый оттенок
u_roughness: 0.8,  // Более текстурированная поверхность
u_pxSize: 4,      // Меньшие пиксели дизеринга
```

### Изменить угол прожектора

```javascript
this.spotLight.angle = Math.PI / 45  // Более широкий прожектор
this.spotLight.penumbra = 0.8        // Более мягкие края
```

## Продвинуто: Собственная модель

Чтобы использовать вашу 3D модель:

1. **Подготовка модели**: Экспортируйте в GLB формате
   - Используйте Blender или подобное ПО
   - Примените материалы/текстуры
   - Оптимизируйте mesh (уменьшите количество полигонов)
   - Размер файла должен быть до 1MB

2. **Конвертация в .txt**: Переименуйте в `.glb.txt` для загрузки в Webflow

3. **Обновление пути**: Измените путь к модели в коде:
   ```javascript
   loader.load('/your-model.glb.txt', ...)
   ```

4. **Настройка масштаба**: Измените `targetSize` если нужно:
   ```javascript
   const targetSize = 2.0  // Большая модель
   ```

## Кредиты

Создано с использованием:
- [Three.js](https://threejs.org/) - 3D рендеринг
- [GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader) - Загрузка моделей
- Кастомные WebGL шейдеры для эффектов пикселизации и дизеринга

## Лицензия

Этот эффект является частью проекта ETH Milan Shader.

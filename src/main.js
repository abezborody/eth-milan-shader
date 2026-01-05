import './style.css'
import { RippleClickEffect } from './RippleClickEffect.js'
import { RippleAsciiWhiteEffect } from './RippleAsciiWhiteEffect.js'
import { HoverTrailAsciiWhiteEffect } from './HoverTrailAsciiWhiteEffect.js'
import { HoverTrailRippleEffect } from './HoverTrailRippleEffect.js'

import { DitheringEffectSimplex } from './DitheringCopyEffect.js'
import { DitheringImageEffect } from './DitheringImageEffect.js'
import { CoinDitheringEffect } from './CoinDitheringEffect.js'
import * as rive from "@rive-app/canvas";

// Available animation types
const ANIMATION_TYPES = [
  { id: 'ripple', name: 'Ripple', Effect: RippleClickEffect },
  { id: 'hover-trail-ripple', name: 'Hover Dither Trail Ripple', Effect: HoverTrailRippleEffect },
  { id: 'ripple-ascii-white', name: 'Ripple ASCII White', Effect: RippleAsciiWhiteEffect },
  { id: 'hover-trail-white', name: 'Hover Trail White', Effect: HoverTrailAsciiWhiteEffect },

  { id: 'dithering-coin', name: 'Dithering Coin', Effect: CoinDitheringEffect, fullscreen: true },
  { id: 'dithering-copy', name: 'Dithering Waves', Effect: DitheringEffectSimplex, fullscreen: true },
  // { id: 'dithering-image', name: 'Dithering Image', Effect: DitheringImageEffect, fullscreen: true },
]

let currentAnimationType = 'ripple'
let effects = []

// Get initial animation type from URL search params
function getInitialAnimationType() {
  const params = new URLSearchParams(window.location.search)
  const typeFromUrl = params.get('effect')
  // Validate that the type exists in our animation types
  if (typeFromUrl && ANIMATION_TYPES.find(t => t.id === typeFromUrl)) {
    return typeFromUrl
  }
  return 'ripple'
}

function createTabs() {
  const tabsHtml = ANIMATION_TYPES.map(type => 
    `<button class="tab ${type.id === currentAnimationType ? 'active' : ''}" data-type="${type.id}">${type.name}</button>`
  ).join('')
  
  return `
    <div class="tabs">
      ${tabsHtml}
    </div>
  `
}

function initEffects() {
  // Dispose existing effects
  for (const effect of effects) {
    effect.dispose()
  }
  effects = []
  
  // Get current effect class
  const currentType = ANIMATION_TYPES.find(t => t.id === currentAnimationType)
  const EffectClass = currentType.Effect
  const isFullscreen = currentType.fullscreen || false
  
  // Clear containers
  const ethContainer = document.getElementById('eth-container')
  const milanContainer = document.getElementById('milan-container')
  const canvasContainer = document.querySelector('.canvas-container')
  
  ethContainer.innerHTML = ''
  milanContainer.innerHTML = ''
  
  if (isFullscreen) {
    // Hide individual containers and create full-screen effect
    ethContainer.style.display = 'none'
    milanContainer.style.display = 'none'
    
    // Create or show full-screen container
    let fullscreenContainer = document.getElementById('fullscreen-container')
    if (!fullscreenContainer) {
      fullscreenContainer = document.createElement('div')
      fullscreenContainer.id = 'fullscreen-container'
      fullscreenContainer.style.width = '100%'
      fullscreenContainer.style.height = '600px'
      canvasContainer.appendChild(fullscreenContainer)
    } else {
      fullscreenContainer.style.display = 'block'
      fullscreenContainer.innerHTML = '' // Clear previous content
    }
    
    // Create full-screen effect
    effects.push(new EffectClass(fullscreenContainer, null, window.innerWidth, 600))
  } else {
    // Show individual containers and create normal effects
    ethContainer.style.display = 'block'
    milanContainer.style.display = 'block'
    
    // Hide and clear full-screen container if it exists
    const fullscreenContainer = document.getElementById('fullscreen-container')
    if (fullscreenContainer) {
      fullscreenContainer.style.display = 'none'
      fullscreenContainer.innerHTML = '' // Clear to prevent orphaned elements
    }
    
    // Create new effects
    effects.push(new EffectClass(ethContainer, '/eth.svg', 373, 407))
    effects.push(new EffectClass(milanContainer, '/milan.svg', 699, 407))
  }
}

function switchAnimation(type) {
  if (type === currentAnimationType) return
  
  currentAnimationType = type
  
  // Update URL search parameter
  const url = new URL(window.location)
  url.searchParams.set('effect', type)
  window.history.replaceState({}, '', url)
  
  // Update tab styles
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.type === type)
  }
  
  // Reinitialize effects
  initEffects()
}

// Initialize the app
// Get initial animation type from URL
currentAnimationType = getInitialAnimationType()

document.querySelector('#app').innerHTML = `
  <div>
    ${createTabs()}
    <div class="canvas-container">
      <div id="eth-container"></div>
      <canvas id="rive" width="258" height="405" style="width: auto; height: 407px; margin-inline: 8px"></canvas>
      <div id="milan-container"></div>
    </div>
  </div>
`

// Add tab click listeners
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => switchAnimation(tab.dataset.type))
}

// Initialize effects
initEffects()

// Initialize Rive animation
async function initRive() {
    const r = new rive.Rive({
      src: "/public/eth-milan-hero-logo.riv",
      canvas: document.getElementById("rive"),
      autoplay: true,
      artboard: "eth-logo", // Optional. If not supplied the default is selected
      stateMachines: "State Machine 1", // Optional. Add if needed
      onLoad: () => {
        r.resizeDrawingSurfaceToCanvas();
      },
    });
  
}

initRive()


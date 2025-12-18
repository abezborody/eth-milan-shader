import './style.css'
import { PixelScrambleEffect } from './PixelScrambleEffect.js'
import { AsciiScrambleEffect } from './AsciiScrambleEffect.js'
import { RippleClickEffect } from './RippleClickEffect.js'

// Available animation types
const ANIMATION_TYPES = [
  { id: 'ripple', name: 'Ripple', Effect: RippleClickEffect },
  { id: 'scramble', name: 'Scramble', Effect: PixelScrambleEffect },
  { id: 'ascii', name: 'ASCII', Effect: AsciiScrambleEffect },
]

let currentAnimationType = 'ripple'
let effects = []

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
  effects.forEach(effect => effect.dispose())
  effects = []
  
  const ethContainer = document.getElementById('eth-container')
  const milanContainer = document.getElementById('milan-container')
  
  // Clear containers
  ethContainer.innerHTML = ''
  milanContainer.innerHTML = ''
  
  // Get current effect class
  const currentType = ANIMATION_TYPES.find(t => t.id === currentAnimationType)
  const EffectClass = currentType.Effect
  
  // Create new effects
  effects.push(new EffectClass(ethContainer, '/eth.svg', 373, 407))
  effects.push(new EffectClass(milanContainer, '/milan.svg', 699, 407))
}

function switchAnimation(type) {
  if (type === currentAnimationType) return
  
  currentAnimationType = type
  
  // Update tab styles
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.type === type)
  })
  
  // Reinitialize effects
  initEffects()
}

// Initialize the app
document.querySelector('#app').innerHTML = `
  <div>
    ${createTabs()}
    <div class="canvas-container">
      <div id="eth-container"></div>
      <div id="milan-container"></div>
    </div>
  </div>
`

// Add tab click listeners
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchAnimation(tab.dataset.type))
})

// Initialize effects
initEffects()


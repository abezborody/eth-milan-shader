/**
 * ScrambleText - A native JavaScript class for text scramble animations
 * Use this in Webflow by adding it to your custom code or as a script tag
 */
class ScrambleText {
  constructor(element, options = {}) {
    this.element = typeof element === 'string'
      ? document.querySelector(element)
      : element;

    this.options = {
      playOnMount: true,
      text: this.element?.textContent || '',
      speed: 1,
      seed: 1,
      step: 1,
      tick: 1,
      scramble: 1,
      chance: 1,
      overflow: true,
      range: [65, 125],
      overdrive: true,
      ignore: [' '],
      onAnimationStart: null,
      onAnimationFrame: null,
      onAnimationEnd: null,
      ...options
    };

    // State
    this.rafId = 0;
    this.elapsed = 0;
    this.fpsInterval = 1000 / (60 * this.options.speed);
    this.stepCount = 0;
    this.scrambleIndex = 0;
    this.control = [];
    this.overdriveIndex = 0;

    // Bind methods
    this.animate = this.animate.bind(this);
    this.draw = this.draw.bind(this);

    // Initialize
    this.init();
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getRandomChar(range) {
    let rand;
    if (range.length === 2) {
      rand = this.getRandomInt(range[0], range[1]);
    } else {
      rand = range[this.getRandomInt(0, range.length - 1)];
    }
    return String.fromCharCode(rand);
  }

  setIfNotIgnored(value, replace) {
    return this.options.ignore.includes(`${value}`) ? value : replace;
  }

  seedForward() {
    if (this.scrambleIndex === this.options.text.length) return;

    for (let i = 0; i < this.options.seed; i++) {
      const index = this.getRandomInt(this.scrambleIndex, this.control.length);
      if (typeof this.control[index] !== 'number' && typeof this.control[index] !== 'undefined') {
        this.control[index] = this.setIfNotIgnored(
          this.control[index],
          this.getRandomInt(0, 10) >= (1 - this.options.chance) * 10 ? this.options.scramble || this.options.seed : 0
        );
      }
    }
  }

  stepForward() {
    for (let i = 0; i < this.options.step; i++) {
      if (this.scrambleIndex < this.options.text.length) {
        const currentIndex = this.scrambleIndex;
        const shouldScramble = this.getRandomInt(0, 10) >= (1 - this.options.chance) * 10;

        this.control[currentIndex] = this.setIfNotIgnored(
          this.options.text[this.scrambleIndex],
          shouldScramble
            ? this.options.scramble + this.getRandomInt(0, Math.ceil(this.options.scramble / 2))
            : 0
        );
        this.scrambleIndex++;
      }
    }
  }

  resizeControl() {
    if (this.options.text.length < this.control.length) {
      this.control.pop();
      this.control.splice(this.options.text.length, this.options.step);
    }
    for (let i = 0; i < this.options.step; i++) {
      if (this.control.length < this.options.text.length) {
        this.control.push(
          this.setIfNotIgnored(this.options.text[this.control.length + 1], null)
        );
      }
    }
  }

  onOverdrive() {
    if (!this.options.overdrive) return;

    for (let i = 0; i < this.options.step; i++) {
      const max = Math.max(this.control.length, this.options.text.length);
      if (this.overdriveIndex < max) {
        this.control[this.overdriveIndex] = this.setIfNotIgnored(
          this.options.text[this.overdriveIndex],
          String.fromCharCode(typeof this.options.overdrive === 'boolean' ? 95 : this.options.overdrive)
        );
        this.overdriveIndex++;
      }
    }
  }

  onTick() {
    this.stepForward();
    this.resizeControl();
    this.seedForward();
  }

  animate(time) {
    if (!this.options.speed) return;

    this.rafId = requestAnimationFrame(this.animate);

    this.onOverdrive();

    const timeElapsed = time - this.elapsed;
    if (timeElapsed > this.fpsInterval) {
      this.elapsed = time;

      if (this.stepCount % this.options.tick === 0) {
        this.onTick();
      }

      this.draw();
    }
  }

  draw() {
    if (!this.element) return;

    let result = '';

    for (let i = 0; i < this.control.length; i++) {
      const controlValue = this.control[i];

      switch (true) {
        case typeof controlValue === 'number' && controlValue > 0:
          result += this.getRandomChar(this.options.range);
          if (i <= this.scrambleIndex) {
            this.control[i] = this.control[i] - 1;
          }
          break;

        case typeof controlValue === 'string' && (i >= this.options.text.length || i >= this.scrambleIndex):
          result += controlValue;
          break;

        case controlValue === this.options.text[i] && i < this.scrambleIndex:
          result += this.options.text[i];
          break;

        case controlValue === 0 && i < this.options.text.length:
          result += this.options.text[i];
          this.control[i] = this.options.text[i];
          break;

        default:
          result += '';
      }
    }

    this.element.innerHTML = result;

    if (this.options.onAnimationFrame) {
      this.options.onAnimationFrame(result);
    }

    if (result === this.options.text) {
      this.control.splice(this.options.text.length, this.control.length);
      if (this.options.onAnimationEnd) {
        this.options.onAnimationEnd();
      }
      cancelAnimationFrame(this.rafId);
    }

    this.stepCount++;
  }

  reset() {
    this.stepCount = 0;
    this.scrambleIndex = 0;
    this.overdriveIndex = 0;
    if (!this.options.overflow) {
      this.control = new Array(this.options.text?.length);
    }
  }

  play() {
    cancelAnimationFrame(this.rafId);
    this.reset();
    if (this.options.onAnimationStart) {
      this.options.onAnimationStart();
    }
    this.rafId = requestAnimationFrame(this.animate);
  }

  updateText(newText) {
    this.options.text = newText;
    this.reset();
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
  }

  init() {
    // Check for reduced motion preference
    const prefersReducedMotion = typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    if (prefersReducedMotion) {
      this.options.step = this.options.text.length;
      this.options.chance = 0;
      this.options.overdrive = false;
    }

    if (!this.options.playOnMount) {
      this.control = this.options.text.split('');
      this.stepCount = this.options.text.length;
      this.scrambleIndex = this.options.text.length;
      this.overdriveIndex = this.options.text.length;
      this.draw();
    } else {
      this.play();
    }
  }
}

// ES Module export
export { ScrambleText };

// CommonJS export for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScrambleText;
}

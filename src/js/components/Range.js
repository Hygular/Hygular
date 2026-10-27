/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import Debug from "../core/Debug.js";

const instances = new WeakMap();

class Range {
  static NAME = "range";
  static SELECTOR = '[data-hygular="range"]';
  #el;
  #inputs;
  #isDual;
  #rafId = null;
  #isRTL;
  #listeners = [];
  #tooltips;
  #track;
  #fill;
  #ticksEl;
  #resizeObserver;

  /**
   * Initialize one or two range inputs, or return the instance already attached to
   * the element.
   */
  constructor(element, options = {}) {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    if (instances.has(element)) {
      return instances.get(element);
    }

    this.#el = element;
    this.options = {
      tooltip: true,
      ticks: true,
      valueLabel: null,
      ...options,
    };

    this.#inputs = Array.from(element.querySelectorAll('input[type="range"]'));
    this.#isDual = this.#inputs.length === 2;

    if (this.#inputs.length === 0) {
      Debug.error(
        "Range: no input[type='range'] found inside element",
        this.#el,
      );
      return;
    }

    if (this.#inputs.length > 2) {
      Debug.error(
        `Range: expected 1 or 2 input[type='range'] elements, found ${this.#inputs.length}`,
        this.#el,
      );
      return;
    }

    this.#rafId = null;
    this.#isRTL = getComputedStyle(element).direction === "rtl";
    this.#listeners = [];

    this._onResize = this._onResize.bind(this);

    this.buildTooltips();
    this.buildDualFill();
    this.buildTicks();
    this.bindEvents();

    if (typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver(this._onResize);
      this.#resizeObserver.observe(this.#el);
    }
    this.update();
    instances.set(element, this);
  }

  /**
   * Return the attached instance, or null if none exists.
   */
  static getInstance(element) {
    return instances.get(element) ?? null;
  }

  /**
   * Reuse the attached instance or create one with the supplied options.
   */
  static getOrCreateInstance(element, options) {
    return instances.get(element) ?? new Range(element, options);
  }

  /**
   * Initialize matching descendants of the supplied root.
   */
  static init(root) {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    root ??= document;
    root
      .querySelectorAll(Range.SELECTOR)
      .forEach((el) => Range.getOrCreateInstance(el));
  }

  /**
   * Create a tooltip for each input when tooltips are enabled.
   */
  buildTooltips() {
    if (!this.options.tooltip) return;
    this.#tooltips = this.#inputs.map(() => {
      const tip = document.createElement("span");
      tip.className = "form-range-tooltip";
      tip.setAttribute("aria-hidden", "true");
      this.#el.appendChild(tip);
      return tip;
    });
  }

  /**
   * Create the shared track and fill for a dual range.
   */
  buildDualFill() {
    if (!this.#isDual) return;
    this.#track = document.createElement("span");
    this.#track.className = "form-range-dual-track";
    this.#fill = document.createElement("span");
    this.#fill.className = "form-range-dual-fill";
    this.#el.prepend(this.#fill);
    this.#el.prepend(this.#track);
  }

  /**
   * Render ticks and labels from a single input's associated datalist.
   */
  buildTicks() {
    if (!this.options.ticks) return;

    // Dual ranges do not render datalist ticks.
    if (this.#isDual) return;

    // Remove old ticks before rebuilding them during refresh().
    if (this.#ticksEl) {
      this.#ticksEl.remove();
      this.#ticksEl = null;
    }

    const input = this.#inputs[0];
    const listId = input.getAttribute("list");
    if (!listId) return;

    const datalist = document.getElementById(listId);
    if (!datalist) return;

    const options = Array.from(datalist.querySelectorAll("option"));
    if (options.length === 0) return;

    const min = parseFloat(input.min || 0);
    const max = parseFloat(input.max || 100);

    this.#ticksEl = document.createElement("div");
    this.#ticksEl.className = "form-range-ticks";
    this.#ticksEl.setAttribute("aria-hidden", "true");

    options.forEach((option) => {
      const value = parseFloat(option.value);
      const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
      const side = this.#isRTL ? 100 - pct : pct;

      const tick = document.createElement("span");
      tick.className = "form-range-tick";
      tick.style.left = `${side}%`;
      this.#ticksEl.appendChild(tick);

      if (option.label) {
        const label = document.createElement("span");
        label.className = "form-range-tick-label";
        label.style.left = `${side}%`;
        label.textContent = option.label;
        this.#ticksEl.appendChild(label);
      }
    });

    this.#el.after(this.#ticksEl);
  }

  /**
   * Bind input, pointer, focus, and keyboard handlers and retain their references
   * for cleanup.
   */
  bindEvents() {
    this.#inputs.forEach((input, index) => {
      const bind = (type, handler, opts) => {
        input.addEventListener(type, handler, opts);
        this.#listeners.push({ input, type, handler, opts });
      };

      bind("input", () => this._onInput(index));
      bind("change", () => this._onChange(index));
      bind("pointerdown", () => this.showTooltip(index), { passive: true });
      bind("pointerup", () => this.hideTooltip(index), { passive: true });
      bind("focus", () => this.showTooltip(index));
      bind("blur", () => this.hideTooltip(index));
      bind("keydown", () => this.showTooltip(index), { passive: true });
    });
  }

  /**
   * Constrain the input, schedule a visual update, and emit the resulting value.
   */
  _onInput(index) {
    this.#constrainValues(index);
    if (this.#rafId) cancelAnimationFrame(this.#rafId);
    this.#rafId = requestAnimationFrame(() => this.update(index));

    this.#el.dispatchEvent(
      new CustomEvent("hygular.range.input", {
        bubbles: true,
        detail: { value: this.getValue(), index },
      }),
    );
  }

  /** Constrain crossed dual values before notifying input listeners. */
  #constrainValues(changedIndex) {
    if (!this.#isDual || changedIndex === undefined) return;
    const [minInput, maxInput] = this.#inputs;
    const step = minInput.step === "any" ? 0 : parseFloat(minInput.step || 1);
    if (parseFloat(minInput.value) <= parseFloat(maxInput.value) - step) return;
    if (changedIndex === 0)
      minInput.value = String(parseFloat(maxInput.value) - step);
    else maxInput.value = String(parseFloat(minInput.value) + step);
  }

  /**
   * Emit the committed value and the index of the changed input.
   */
  _onChange(index) {
    this.#el.dispatchEvent(
      new CustomEvent("hygular.range.change", {
        bubbles: true,
        detail: { value: this.getValue(), index },
      }),
    );
  }

  /**
   * Show the tooltip for one input.
   */
  showTooltip(index) {
    this.#tooltips?.[index]?.classList.add("is-visible");
  }

  /**
   * Hide the tooltip for one input.
   */
  hideTooltip(index) {
    this.#tooltips?.[index]?.classList.remove("is-visible");
  }

  /**
   * Reposition tooltips after the container is resized.
   */
  _onResize() {
    this.positionTooltips();
  }

  /**
   * Map the input value to a percentage, reversing it for RTL layout.
   */
  percentage(input) {
    const min = parseFloat(input.min || 0);
    const max = parseFloat(input.max || 100);
    if (max === min) return 0;
    const pct = ((parseFloat(input.value) - min) / (max - min)) * 100;
    return this.#isRTL ? 100 - pct : pct;
  }

  /**
   * Update fill and tooltips; constrain crossed dual values when the changed input
   * is known.
   */
  update(changedIndex) {
    if (this.#isDual) {
      const [minInput, maxInput] = this.#inputs;
      this.#constrainValues(changedIndex);

      const minPct = this.percentage(minInput);
      const maxPct = this.percentage(maxInput);
      const [lowPct, highPct] =
        minPct <= maxPct ? [minPct, maxPct] : [maxPct, minPct];
      this.#fill.style.setProperty("--range-min", `${lowPct}%`);
      this.#fill.style.setProperty("--range-max", `${highPct}%`);

      // Keep the focused thumb above the other thumb when they overlap.
      minInput.style.zIndex = document.activeElement === minInput ? "2" : "1";
      maxInput.style.zIndex = document.activeElement === maxInput ? "2" : "1";

      minInput.setAttribute("aria-valuetext", this.formatValue(minInput.value));
      maxInput.setAttribute("aria-valuetext", this.formatValue(maxInput.value));
    } else {
      const input = this.#inputs[0];
      input.style.setProperty("--range-progress", `${this.percentage(input)}%`);
      input.setAttribute("aria-valuetext", this.formatValue(input.value));
    }

    if (this.options.tooltip) this.positionTooltips();
  }

  /**
   * Position each tooltip using the input width and configured thumb size.
   */
  positionTooltips() {
    this.#inputs.forEach((input, index) => {
      const tip = this.#tooltips?.[index];
      if (!tip) return;

      tip.textContent = this.formatValue(input.value);

      const pct = this.percentage(input);
      const thumbSize =
        parseFloat(getComputedStyle(input).getPropertyValue("--range-thumb")) ||
        20;
      const x = (pct / 100) * (input.offsetWidth - thumbSize) + thumbSize / 2;
      tip.style.setProperty("--range-tooltip-x", `${x}px`);
    });
  }

  /**
   * Format a value with the callback or template, falling back to a string.
   */
  formatValue(value) {
    if (typeof this.options.valueLabel === "function") {
      return this.options.valueLabel(value);
    }
    if (typeof this.options.valueLabel === "string") {
      return this.options.valueLabel.replace("{value}", value);
    }
    return String(value);
  }

  /**
   * Return a number for a single input or a two-item array for a dual range.
   */
  getValue() {
    return this.#isDual
      ? this.#inputs.map((input) => parseFloat(input.value))
      : parseFloat(this.#inputs[0].value);
  }

  /**
   * Assign the input values, update the visuals, and dispatch bubbling input
   * events.
   */
  setValue(value) {
    if (this.#isDual && Array.isArray(value)) {
      this.#inputs[0].value = String(value[0]);
      this.#inputs[1].value = String(value[1]);
    } else {
      this.#inputs[0].value = String(value);
    }
    this.update();
    this.#inputs.forEach((input) =>
      input.dispatchEvent(new Event("input", { bubbles: true })),
    );
  }

  /**
   * Rebuild datalist ticks and update the current fill and tooltip positions.
   */
  refresh() {
    this.buildTicks();
    this.update();
  }

  /**
   * Cancel pending updates, detach listeners and observers, remove generated
   * elements, and unregister the instance.
   */
  dispose() {
    if (this.#rafId) cancelAnimationFrame(this.#rafId);
    this.#resizeObserver?.disconnect();
    this.#listeners.forEach(({ input, type, handler, opts }) =>
      input.removeEventListener(type, handler, opts),
    );
    this.#listeners = [];
    this.#tooltips?.forEach((tip) => tip.remove());
    this.#track?.remove();
    this.#fill?.remove();
    this.#ticksEl?.remove();
    instances.delete(this.#el);
  }
}

export default Range;

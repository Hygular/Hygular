/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import Debug from "../core/Debug.js";

export default class Carousel {
  static #instances = new Map();
  static #count = 0;
  static get instances() {
    return Carousel.#instances;
  }

  /**
   * Create and initialize a carousel. Return null if the target has no slides.
   */
  static create(selector, options = {}) {
    const instance = new Carousel(selector, options);
    if (!instance.#root || !instance.#inner || !instance.#items?.length) {
      Debug.warn(
        `[Carousel] Missing root, inner element, or carousel items. Instance was not created.`,
      );
      return null;
    }
    instance.build();
    return instance;
  }

  static get(id) {
    return Carousel.#instances.get(id);
  }

  #id = null;
  #root = null;
  #inner = null;
  #items = null;
  #pagerEl = null;
  #thumbEl = null;
  #interval = null;
  #isDragging = false;
  #isPausedByHover = false;
  #isPausedBySwipe = false;
  #handleNext = null;
  #handlePrev = null;
  #handleStart = null;
  #handleMove = null;
  #handleEnd = null;
  #handleEnter = null;
  #handleLeave = null;

  // Pointer gesture state
  #swipe = {
    x: null,
    y: null,
    dx: 0,
    dy: 0,
    startTime: 0,
    threshold: 40,
  };

  #config = {};
  #current = 1;

  // Default options
  static defaults = {
    mode: "slide",
    autoplay: {
      enabled: true,
      interval: 4000,
      pauseOnHover: true,
      pauseOnSwipe: true,
    },
    controls: true,
    pager: true,
    thumbnails: { enabled: false, clickable: true },
    swipe: true,
    loop: true,
  };

  // DOM selectors
  static selector = {
    inner: ".carousel-items",
    pager: ".pager",
    thumbs: ".thumbnails",
    next: ".carousel-next",
    prev: ".carousel-prev",
  };

  // CSS class names
  static class = {
    active: "is-active",
    fade: "is-fade",
  };

  // Control markup
  static template = {
    next: `<button type="button" class="button carousel-next next-icon" aria-label="Next"></button>`,
    prev: `<button type="button" class="button carousel-prev prev-icon" aria-label="Prev"></button>`,
    pager: `<ul class="pager"></ul>`,
    pagerItem: `<li class="item"><button type="button"></button></li>`,
    thumbs: `<ul class="thumbnails"></ul>`,
  };

  /**
   * Resolve the slide container, merge options, and register the instance.
   */
  constructor(selector, options = {}) {
    // Skip DOM setup outside the browser.
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    // Accept a selector or an existing element.
    this.#root =
      selector instanceof Element ? selector : document.querySelector(selector);

    if (!(this.#root instanceof Element)) {
      Debug.warn("[Carousel] Target element was not found.");
      return;
    }

    this.#config = Carousel.deepMerge(Carousel.defaults, options);
    this.#inner = this.#root.querySelector(Carousel.selector.inner);
    this.#items = [...(this.#inner?.children ?? [])];
    if (!this.#inner || !this.#items.length) return;
    this.#id = `carousel-${++Carousel.#count}`;
    Carousel.#instances.set(this.#id, this);
    this.#createHandlers();
  }

  /**
   * Recursively merge nested option objects with the defaults.
   */
  static deepMerge(target, source) {
    const output = { ...target };
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        output[key] = Carousel.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }

  /**
   * Add navigation controls and start the configured interaction and autoplay
   * behavior.
   */
  build() {
    this.#root.setAttribute("role", "region");
    this.#root.setAttribute("aria-roledescription", "carousel");
    this.#root.setAttribute(
      "aria-live",
      this.#config.autoplay.enabled ? "off" : "polite",
    );
    this.#applyControls();
    this.#applyPagerOrThumbs();
    if (this.#config.swipe) this.#enableSwipe();
    if (this.#config.autoplay.enabled) this.#startAutoplay();
    this.#applyHoverAutoplay();
    this.go(1);
  }

  /**
   * Move to a one-based slide index, wrapping or clamping at the ends.
   */
  go(index) {
    const max = this.#items.length;

    if (this.#config.loop) {
      if (index > max) index = 1;
      if (index < 1) index = max;
    } else {
      index = Math.min(Math.max(index, 1), max);
    }

    this.#current = index;
    const pos = -(index - 1) * 100 + "%";

    if (this.#config.mode === "fade") {
      this.#inner.style.transform = "";
      this.#root.classList.add(Carousel.class.fade);

      this.#items.forEach((x) => x.classList.remove(Carousel.class.active));
      this.#items[index - 1].classList.add(Carousel.class.active);
    } else {
      this.#root.classList.remove(Carousel.class.fade);
      this.#inner.style.transform = `translateX(${pos})`;
    }

    this.#updateNavigation(this.#pagerEl);
    this.#updateNavigation(this.#thumbEl);
  }

  /**
   * Advance one slide and restart autoplay when it is not paused.
   */
  next() {
    this.#stopAutoplay();
    this.go(this.#current + 1);
    this.#resumeAutoplay();
  }

  /**
   * Move back one slide and restart autoplay when it is not paused.
   */
  prev() {
    this.#stopAutoplay();
    this.go(this.#current - 1);
    this.#resumeAutoplay();
  }

  /**
   * Append previous and next buttons and bind their click handlers.
   */
  #applyControls() {
    if (!this.#config.controls) return;
    this.#root.insertAdjacentHTML("beforeend", Carousel.template.prev);
    this.#root.insertAdjacentHTML("beforeend", Carousel.template.next);
    this.#root
      .querySelector(Carousel.selector.next)
      .addEventListener("click", this.#handleNext);
    this.#root
      .querySelector(Carousel.selector.prev)
      .addEventListener("click", this.#handlePrev);
  }

  /**
   * Use thumbnails instead of the pager when both options are enabled.
   */
  #applyPagerOrThumbs() {
    if (this.#config.pager && this.#config.thumbnails.enabled) {
      this.#config.pager = false;
    }
    if (this.#config.pager) {
      this.#buildPager();
    } else if (this.#config.thumbnails.enabled) {
      this.#buildThumbs();
    }
  }

  /**
   * Create one clickable pager item per slide.
   */
  #buildPager() {
    this.#inner.insertAdjacentHTML("afterend", Carousel.template.pager);
    this.#pagerEl = this.#root.querySelector(Carousel.selector.pager);
    this.#items.forEach(() =>
      this.#pagerEl.insertAdjacentHTML(
        "beforeend",
        Carousel.template.pagerItem,
      ),
    );
    [...this.#pagerEl.children].forEach((li, i) => {
      const button = li.querySelector("button");
      button.setAttribute("aria-label", `Go to slide ${i + 1}`);
      button.addEventListener("click", () => {
        this.go(i + 1);
        this.#restartAutoplay();
      });
    });
  }

  /**
   * Create thumbnails from slide images and bind navigation when enabled.
   */
  #buildThumbs() {
    this.#inner.insertAdjacentHTML("afterend", Carousel.template.thumbs);
    this.#thumbEl = this.#root.querySelector(Carousel.selector.thumbs);
    this.#items.forEach((slide, index) => {
      const img = slide.querySelector("img");
      const li = document.createElement("li");
      li.className = "item";
      const thumb = document.createElement("img");
      thumb.className = "thumbnail-image";
      try {
        thumb.src = new URL(img?.src ?? "", location.href).href;
      } catch {
        thumb.src = "";
      }
      thumb.alt = "";
      if (this.#config.thumbnails.clickable) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `Go to slide ${index + 1}`);
        button.appendChild(thumb);
        li.appendChild(button);
      } else li.appendChild(thumb);
      this.#thumbEl.appendChild(li);
    });

    if (this.#config.thumbnails.clickable)
      [...this.#thumbEl.children].forEach((t, i) =>
        t.querySelector("button").addEventListener("click", () => {
          this.go(i + 1);
          this.#restartAutoplay();
        }),
      );
  }
  /**
   * Update the active item and aria-current state in the pager or thumbnails.
   */
  #updateNavigation(container) {
    if (!container) return;
    [...container.children].forEach((item, index) => {
      const active = index === this.#current - 1;
      item.classList.toggle(Carousel.class.active, active);
      item
        .querySelector("button")
        ?.setAttribute("aria-current", String(active));
    });
  }

  /**
   * Attach pointer handlers to the slide container.
   */
  #enableSwipe() {
    this.#inner.addEventListener("pointerdown", this.#handleStart);
    this.#inner.addEventListener("pointermove", this.#handleMove);
    this.#inner.addEventListener("pointerup", this.#handleEnd);
    this.#inner.addEventListener("pointercancel", this.#handleEnd);
  }

  /**
   * Record the pointer origin and pause autoplay when configured.
   */
  #startSwipe(e) {
    e.preventDefault();
    this.#isDragging = true;
    if (this.#config.autoplay.pauseOnSwipe) {
      this.#isPausedBySwipe = true;
      this.#stopAutoplay();
    }
    this.#swipe.dx = 0;
    this.#swipe.dy = 0;
    this.#swipe.x = e.clientX;
    this.#swipe.y = e.clientY;
    this.#swipe.startTime = performance.now();
  }

  /**
   * Track horizontal and vertical movement during a drag.
   */
  #moveSwipe(e) {
    if (!this.#isDragging) return;
    this.#swipe.dx = this.#swipe.x - e.clientX;
    this.#swipe.dy = this.#swipe.y - e.clientY;
  }

  /**
   * Resume autoplay when allowed and navigate if the gesture passes the swipe
   * thresholds.
   */
  #endSwipe() {
    if (!this.#isDragging) return;
    this.#isDragging = false;
    if (this.#config.autoplay.pauseOnSwipe) {
      this.#isPausedBySwipe = false;
      if (!this.#isPausedByHover) this.#resumeAutoplay();
    }
    const dt = performance.now() - this.#swipe.startTime;
    if (
      Math.abs(this.#swipe.dx) > Math.abs(this.#swipe.dy) &&
      Math.abs(this.#swipe.dx) > this.#swipe.threshold &&
      dt > 120
    ) {
      this.#swipe.dx > 0 ? this.next() : this.prev();
    }
  }

  /**
   * Start the autoplay interval if enabled and not already running.
   */
  #startAutoplay() {
    if (!this.#config.autoplay.enabled || this.#interval) return;
    this.#interval = setInterval(
      () => this.go(this.#current + 1),
      this.#config.autoplay.interval,
    );
  }

  /**
   * Stop the autoplay interval.
   */
  #stopAutoplay() {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  }

  /**
   * Resume autoplay only when neither hover nor swipe is holding it paused.
   */
  #resumeAutoplay() {
    if (
      this.#config.autoplay.enabled &&
      !this.#isPausedByHover &&
      !this.#isPausedBySwipe
    )
      this.#startAutoplay();
  }

  /**
   * Restart the autoplay interval after manual navigation.
   */
  #restartAutoplay() {
    if (!this.#config.autoplay.enabled) return;
    this.#stopAutoplay();
    this.#resumeAutoplay();
  }

  /**
   * Create stable handler references for listener registration and removal.
   */
  #createHandlers() {
    this.#handleNext = () => this.next();
    this.#handlePrev = () => this.prev();
    this.#handleStart = (e) => this.#startSwipe(e);
    this.#handleMove = (e) => this.#moveSwipe(e);
    this.#handleEnd = () => this.#endSwipe();
    this.#handleEnter = () => {
      this.#isPausedByHover = true;
      this.#stopAutoplay();
    };
    this.#handleLeave = () => {
      this.#isPausedByHover = false;
      if (!this.#isPausedBySwipe) this.#resumeAutoplay();
    };
  }

  /**
   * Bind hover handlers when pause-on-hover is enabled.
   */
  #applyHoverAutoplay() {
    if (!this.#config.autoplay.pauseOnHover) return;
    this.#root.addEventListener("pointerenter", this.#handleEnter);
    this.#root.addEventListener("pointerleave", this.#handleLeave);
  }

  /**
   * Stop autoplay, detach interaction handlers, remove navigation controls, and
   * unregister the instance.
   */
  dispose() {
    this.#stopAutoplay();
    if (!this.#root || !this.#inner) return;
    this.#root
      .querySelector(Carousel.selector.next)
      ?.removeEventListener("click", this.#handleNext);
    this.#root
      .querySelector(Carousel.selector.prev)
      ?.removeEventListener("click", this.#handlePrev);
    this.#pagerEl?.remove();
    this.#thumbEl?.remove();
    this.#root.querySelector(Carousel.selector.next)?.remove();
    this.#root.querySelector(Carousel.selector.prev)?.remove();
    this.#inner.removeEventListener("pointerdown", this.#handleStart);
    this.#inner.removeEventListener("pointermove", this.#handleMove);
    this.#inner.removeEventListener("pointerup", this.#handleEnd);
    this.#inner.removeEventListener("pointercancel", this.#handleEnd);
    Carousel.#instances.delete(this.#id);
    this.#root.removeEventListener("pointerenter", this.#handleEnter);
    this.#root.removeEventListener("pointerleave", this.#handleLeave);
  }
}

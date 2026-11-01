/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import Debug from "./Debug.js";
import Components from "./Component.js";
import { applyConfig } from "./Config.js";
import Carousel from "../components/Carousel.js";
import Modal from "../components/Modal.js";
import Alert from "../components/Alert.js";
import Select from "../components/Select.js";
import Tooltip from "../components/Tooltip.js";
import Toast from "../components/Toast.js";
import DarkMode from "../components/DarkMode.js";
import Skeleton from "../components/Skeleton.js";
import LazyImage from "../components/LazyImage.js";
import Popover from "../components/Popover.js";
import Form from "../components/Form.js";
import Range from "../components/Range.js";

const LAZY_SELECTOR = '[data-hygular], [data-hygular-toggle="popover"]';

function getComponentName(element) {
  return (
    element.getAttribute("data-hygular") ||
    (element.getAttribute("data-hygular-toggle") === "popover"
      ? "popover"
      : null)
  );
}

export default class Hygular {
  #isDisposed = false;
  #instancesByElement = new Map();

  /**
   * Apply configuration, register delegated handlers, and observe lazy component
   * targets.
   */
  constructor(config = {}) {
    // Skip runtime setup outside the browser.
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    if (config.debug) Debug.enable();

    this.registry = {
      delegate: {
        navbar: Components.navbar,
        collapse: Components.collapse,
        dropdown: Components.dropdown,
        drawer: Components.drawer,
        accordion: Components.accordion,
        alert: Components.alert,
        form: Form.init,
      },
      lazy: {
        swiper: Components.swiper,
        badge: Components.badge,
        tabview: Components.tabview,
        tooltip: (el) => new Tooltip(el),
        popover: (el) => new Popover(el),
        range: (el) => new Range(el),
      },
    };

    this.config = config;
    applyConfig(config);
    this.modal = Modal;
    this.toast = Toast;
    this.carousel = Carousel;
    this.alert = {
      create: Alert.create,
    };
    this.darkMode = DarkMode;
    this.select = Select;
    this.skeleton = Skeleton;
    this.tooltip = Tooltip;
    this.popover = Popover;
    this.form = Form;
    this.range = Range;

    // Track disposable instances created by lazy initialization.
    this.componentInstances = new Set();
    this.loadedComponents = new WeakSet();
    this.observer = this.setupObserver();
    this.mutationObserver = this.setupMutationObserver();
    this.startObserving(document.body);
    this.init();
  }

  /**
   * Register delegated handlers and observe existing lazy component and image
   * targets.
   */
  init() {
    if (this.#isDisposed || typeof document === "undefined") return;

    const previous = this.disposeMap;
    const next = new Map();
    try {
      for (const name in this.registry.delegate) {
        const dispose = this.registry.delegate[name]?.();
        if (typeof dispose === "function")
          next.set(`delegate:${name}`, dispose);
        if (this.#isDisposed) {
          next.forEach((dispose) => dispose());
          return;
        }
      }
    } catch (error) {
      next.forEach((dispose) => dispose());
      throw error;
    }
    // Acquire replacements before releasing subscriptions with pending work.
    this.disposeMap = next;
    previous?.forEach((dispose) => dispose());

    document.querySelectorAll(LAZY_SELECTOR).forEach((el) => {
      const name = getComponentName(el);
      if (this.registry.lazy[name]) {
        this.observeElement(el);
      }
    });
    document
      .querySelectorAll("img[data-src]")
      .forEach((img) => this.observeElement(img));
  }

  /**
   * Create the shared observer that initializes targets as they approach the
   * viewport.
   */
  setupObserver() {
    return new IntersectionObserver(
      (entries) => {
        if (this.#isDisposed) return;
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            !this.loadedComponents.has(entry.target)
          ) {
            const el = entry.target;
            // Load deferred images before checking component callbacks.
            if (el.tagName === "IMG" && el.dataset.src) {
              LazyImage.load(el);
              this.loadedComponents.add(el);
              this.observer.unobserve(el);
              return;
            }
            // Run a custom initializer when one is attached to the target.
            if (el.FnCallback && typeof el.FnCallback === "function") {
              el.FnCallback(el);
              this.loadedComponents.add(el);
              this.observer.unobserve(el);
              return;
            }
            this.handleVisibleComponent(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "100px 0px", threshold: 0.1 },
    );
  }

  /**
   * Observe inserted targets and dispose tracked instances removed from the document.
   */
  setupMutationObserver() {
    return new MutationObserver((mutations) => {
      if (this.#isDisposed) return;
      // A move produces a removal record too; retain nodes still in the document.
      if (mutations.some((mutation) => mutation.removedNodes.length)) {
        this.#instancesByElement.forEach((instance, element) => {
          if (element.isConnected) return;
          instance.dispose();
          this.componentInstances.delete(instance);
          this.loadedComponents.delete(element);
          this.#instancesByElement.delete(element);
        });
      }
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1 || this.loadedComponents.has(node)) return;
          if (node.matches(LAZY_SELECTOR)) {
            const name = getComponentName(node);
            if (this.registry.lazy[name]) {
              this.observeElement(node);
            }
          }
          if (node.tagName === "IMG" && node.dataset.src) {
            this.observeElement(node);
          }
          node.querySelectorAll?.(LAZY_SELECTOR).forEach((child) => {
            if (!this.loadedComponents.has(child)) {
              const name = getComponentName(child);
              if (this.registry.lazy[name]) {
                this.observeElement(child);
              }
            }
          });
          node.querySelectorAll?.("img[data-src]").forEach((img) => {
            if (!this.loadedComponents.has(img)) {
              this.observeElement(img);
            }
          });
        });
      });
    });
  }

  /**
   * Read the target's component name and initialize it.
   */
  handleVisibleComponent(element) {
    const componentName = getComponentName(element);
    this.initializeComponent(componentName, element);
  }

  /**
   * Run the registered initializer and retain disposable instances for runtime
   * cleanup.
   */
  initializeComponent(name, element) {
    if (this.#isDisposed) return null;
    if (this.loadedComponents.has(element)) {
      return this.#instancesByElement.get(element) ?? null;
    }
    const component = this.registry.lazy[name];

    if (typeof component === "function") {
      const instance = component(element);

      if (instance && typeof instance.dispose === "function") {
        this.componentInstances.add(instance);
        this.#instancesByElement.set(element, instance);
      }

      this.loadedComponents.add(element);
      return instance;
    }

    console.error(`Hygular: lazy component not found: ${name}`);
    return null;
  }

  /**
   * Registers an element for lazy observation.
   */
  observeElement(element) {
    if (this.#isDisposed) return;
    if (!this.loadedComponents.has(element)) {
      this.observer.observe(element);
    }
  }

  /**
   * Watch the container for inserted descendants.
   */
  startObserving(container) {
    if (container) {
      this.mutationObserver.observe(container, {
        childList: true,
        subtree: true,
      });
    }
  }

  /**
   * Disconnect observers, run delegate cleanup, and dispose tracked component
   * instances.
   */
  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    this.observer?.disconnect();
    this.mutationObserver?.disconnect();
    this.disposeMap?.forEach((fn) => fn());
    this.disposeMap?.clear();
    this.componentInstances?.forEach((instance) => {
      instance.dispose?.();
    });
    this.componentInstances?.clear();
    this.#instancesByElement.clear();
    this.loadedComponents = null;
  }
}

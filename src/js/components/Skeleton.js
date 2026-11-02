/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

export default class Skeleton {
  /**
   * Apply the loading state and create a placeholder overlay unless the show event
   * is canceled.
   */
  static show(el) {
    if (!el || el.skeletonActive) return;
    if (Skeleton._emit(el, "hygular.skeleton.show", true)) return;

    el.skeletonActive = true;
    el.skeletonAriaHidden = el.getAttribute("aria-hidden");
    el.skeletonAriaLabel = el.getAttribute("aria-label");

    el.setAttribute("aria-hidden", "true");
    el.setAttribute("aria-label", "Loading…");
    el.setAttribute("data-skeleton", "");

    Skeleton.clearError(el);
    Skeleton.injectWave(el);
    Skeleton.watchResize(el);
    Skeleton._emit(el, "hygular.skeleton.shown");
  }

  /**
   * Remove the loading overlay and restore the saved accessibility attributes
   * unless hiding is canceled.
   */
  static hide(el) {
    if (!el || !el.skeletonActive) return;
    if (Skeleton._emit(el, "hygular.skeleton.hide", true)) return;
    Skeleton.resetLoading(el);
    Skeleton._emit(el, "hygular.skeleton.hidden");
  }

  /**
   * Replace the loading state with an error message and an optional retry button.
   */
  static error(el, opts = {}) {
    if (!el) return;
    const { message = "Failed to load", retry = false, onRetry = null } = opts;

    // Clean up active skeleton if present
    if (el.skeletonActive) Skeleton.resetLoading(el);

    Skeleton.clearError(el);
    el.setAttribute("data-skeleton-error", "");
    el.setAttribute("aria-live", "polite");

    const layer = Skeleton._createElement("div", "hygular-sk-error-layer", {
      "data-skeleton-injected": "",
      "data-skeleton-ignore": "",
      role: "alert",
    });

    layer.appendChild(Skeleton.createErrorIcon());

    const msg = Skeleton._createElement("p", "hygular-sk-error-msg");
    msg.textContent = message;
    layer.appendChild(msg);

    if (retry) {
      const btn = Skeleton._createElement("button", "hygular-sk-retry");
      btn.type = "button";
      btn.textContent = "Try again";
      btn.addEventListener("click", () => {
        Skeleton.clearError(el);
        if (typeof onRetry === "function") onRetry(el);
        Skeleton._emit(el, "hygular.skeleton.retry");
      });
      layer.appendChild(btn);
    }

    el.appendChild(layer);
    Skeleton._emit(el, "hygular.skeleton.error", false, { message });
  }

  /**
   * Show loading while the task runs. On failure, display an error and rethrow it.
   */
  static async wrap(el, asyncFn, opts = {}) {
    Skeleton.show(el);
    try {
      return await asyncFn();
    } catch (err) {
      Skeleton.error(el, {
        message: opts.message ?? err.message ?? "Failed to load",
        retry: opts.retry ?? false,
        onRetry: opts.onRetry ?? null,
      });
      throw err;
    } finally {
      if (el.skeletonActive) Skeleton.hide(el);
    }
  }

  /**
   * Activate existing and inserted targets. Return cleanup for observers and owned overlays.
   */
  static mount() {
    if (typeof window === "undefined" || typeof document === "undefined")
      return () => {};
    if (Skeleton.mountCleanup) return Skeleton.mountCleanup;
    const managed = new Set();
    let disposed = false;
    const activate = (el) => {
      if (
        el.getAttribute("data-skeleton-auto") === "false" ||
        el.skeletonActive
      )
        return;
      Skeleton.show(el);
      if (el.skeletonActive) managed.add(el);
    };
    document.querySelectorAll("[data-skeleton]").forEach(activate);
    Skeleton._mutationObserver = new MutationObserver((mutations) => {
      if (disposed) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.hasAttribute("data-skeleton")) activate(node);
          node.querySelectorAll("[data-skeleton]").forEach(activate);
        }
      }
    });
    Skeleton._mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    // Teardown must not depend on a cancelable hide event.
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      Skeleton._mutationObserver.disconnect();
      Skeleton._mutationObserver = null;
      Skeleton.mountCleanup = null;
      managed.forEach((el) => {
        if (!el.skeletonActive) return;
        Skeleton.resetLoading(el);
      });
      managed.clear();
    };
    Skeleton.mountCleanup = cleanup;
    return cleanup;
  }

  /** Clear loading state without dispatching a cancelable hide event. */
  static resetLoading(el) {
    el.skeletonActive = false;
    el.removeAttribute("data-skeleton");
    Skeleton.unwatchResize(el);
    Skeleton.restoreAria(el);
    Skeleton.removeOverlay(el);
  }

  /**
   * Rebuild the placeholder overlay when the target size changes.
   */
  static watchResize(el) {
    if (el.skeletonResizeObserver || typeof ResizeObserver === "undefined")
      return;
    el.skeletonResizeObserver = new ResizeObserver(() => {
      if (el.skeletonActive) {
        Skeleton.removeOverlay(el);
        Skeleton.injectWave(el);
      }
    });
    el.skeletonResizeObserver.observe(el);
  }

  static unwatchResize(el) {
    if (el.skeletonResizeObserver) {
      el.skeletonResizeObserver.disconnect();
      el.skeletonResizeObserver = null;
    }
  }

  /**
   * Create placeholder shapes from the selected layout or the target's current
   * content.
   */
  static injectWave(el) {
    if (el.querySelector("[data-skeleton-injected]")) return;

    const overlay = Skeleton._createElement("div", "hygular-sk-wave-overlay", {
      "data-skeleton-injected": "",
      "data-skeleton-ignore": "",
      "aria-hidden": "true",
    });

    const layout = el.getAttribute("data-skeleton-layout") || "auto";
    const w = el.offsetWidth || 300;
    const h = el.offsetHeight || 200;

    const shapes =
      layout === "card"
        ? Skeleton.createCard(el, w, h)
        : layout === "list"
          ? Skeleton.createList(el, w, h)
          : layout === "article"
            ? Skeleton.createArticle(w, h)
            : layout === "profile"
              ? Skeleton.createProfile(w, h)
              : Skeleton.detectShapes(el, el.getBoundingClientRect());

    if (shapes.length === 0) {
      const g = Skeleton._createElement("span", "hygular-sk-ghost");
      g.style.cssText = "position:absolute;inset:0;border-radius:inherit;";
      overlay.appendChild(g);
    } else {
      for (const s of shapes) {
        const g = Skeleton._createElement("span", "hygular-sk-ghost");
        g.style.cssText =
          `position:absolute;` +
          `top:${s.top}px;left:${s.left}px;` +
          `width:${s.width}px;height:${s.height}px;` +
          `border-radius:${s.radius};`;
        overlay.appendChild(g);
      }
    }

    el.appendChild(overlay);
  }

  /**
   * Build a card grid from the configured row and column counts.
   */
  static createCard(el, w, h) {
    const cols = Math.max(
      1,
      parseInt(el.getAttribute("data-skeleton-cols"), 10) ||
        Math.max(1, Math.round(w / 220)),
    );
    const rows = Math.max(
      1,
      parseInt(el.getAttribute("data-skeleton-rows"), 10) || 2,
    );
    const gap = 12;
    const cardW = (w - gap * (cols - 1)) / cols;
    const cardH = (h - gap * (rows - 1)) / rows;
    const shapes = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * (cardW + gap);
        const y = r * (cardH + gap);
        shapes.push({
          top: y,
          left: x,
          width: cardW,
          height: cardH * 0.52,
          radius: "8px",
        }); // thumbnail
        shapes.push({
          top: y + cardH * 0.57,
          left: x,
          width: 32,
          height: 32,
          radius: "50%",
        }); // avatar
        shapes.push({
          top: y + cardH * 0.57 + 6,
          left: x + 42,
          width: cardW * 0.55,
          height: 11,
          radius: "6px",
        }); // title
        shapes.push({
          top: y + cardH * 0.57 + 24,
          left: x + 42,
          width: cardW * 0.35,
          height: 9,
          radius: "6px",
        }); // subtitle
        shapes.push({
          top: y + cardH * 0.83,
          left: x,
          width: cardW * 0.42,
          height: 9,
          radius: "6px",
        }); // tag
      }
    }
    return shapes;
  }

  /**
   * Build repeated avatar and text placeholders for a list layout.
   */
  static createList(el, w, h) {
    const count = Math.max(
      1,
      parseInt(el.getAttribute("data-skeleton-rows"), 10) || 5,
    );
    const rowH = 56;
    const shapes = [];

    for (let i = 0; i < count; i++) {
      const y = i * rowH;
      shapes.push({
        top: y + 10,
        left: 12,
        width: 36,
        height: 36,
        radius: "50%",
      }); // avatar
      shapes.push({
        top: y + 13,
        left: 60,
        width: w * (0.4 + (i % 3) * 0.07),
        height: 11,
        radius: "6px",
      }); // line 1
      shapes.push({
        top: y + 31,
        left: 60,
        width: w * (0.25 + (i % 2) * 0.06),
        height: 9,
        radius: "6px",
      }); // line 2
    }
    return shapes;
  }

  /**
   * Build an image placeholder followed by text lines for an article layout.
   */
  static createArticle(w, h) {
    const heroH = Math.min(200, h * 0.4);
    const shapes = [
      { top: 0, left: 0, width: w, height: heroH, radius: "10px" },
    ];
    const widths = [0.9, 0.76, 0.83, 0.6, 0.78, 0.5];
    let y = heroH + 18;
    for (const frac of widths) {
      shapes.push({
        top: y,
        left: 0,
        width: w * frac,
        height: 12,
        radius: "6px",
      });
      y += 21;
    }
    return shapes;
  }

  static createProfile(w) {
    const av = 64;
    const lx = av + 16;
    const lw = w - lx - 8;
    return [
      { top: 0, left: 0, width: av, height: av, radius: "50%" },
      { top: 5, left: lx, width: lw * 0.55, height: 13, radius: "6px" },
      { top: 25, left: lx, width: lw * 0.38, height: 11, radius: "6px" },
      { top: 50, left: lx, width: lw * 0.7, height: 10, radius: "6px" },
      { top: 67, left: lx, width: lw * 0.5, height: 10, radius: "6px" },
    ];
  }

  /**
   * Measure visible descendants to approximate their content with placeholder
   * shapes.
   */
  static detectShapes(root, rootRect) {
    const shapes = [];
    const INLINE_TAGS = new Set([
      "SPAN",
      "A",
      "STRONG",
      "EM",
      "B",
      "I",
      "LABEL",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "P",
      "LI",
      "TD",
      "TH",
      "CAPTION",
      "FIGCAPTION",
      "TIME",
      "CODE",
      "KBD",
      "MARK",
      "SMALL",
    ]);
    const BLOCK_TAGS = new Set([
      "IMG",
      "SVG",
      "VIDEO",
      "CANVAS",
      "INPUT",
      "TEXTAREA",
      "SELECT",
      "BUTTON",
      "PICTURE",
      "FIGURE",
      "IFRAME",
      "HR",
      "TABLE",
      "PROGRESS",
      "METER",
    ]);

    const getRadius = (node) => {
      try {
        const cs = getComputedStyle(node);
        const r = cs.borderRadius || "0px";
        const px = parseFloat(r);
        const min = Math.min(
          parseFloat(cs.width) || 0,
          parseFloat(cs.height) || 0,
        );
        return px >= min / 2 && min > 0 ? "50%" : r;
      } catch {
        return "4px";
      }
    };

    const visit = (node) => {
      if (node.nodeType !== 1) return;
      if (node.hasAttribute?.("data-skeleton-ignore")) return;
      if (node.hasAttribute?.("data-skeleton-injected")) return;
      const rect = node.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const top = rect.top - rootRect.top;
      const left = rect.left - rootRect.left;
      if (top + rect.height < 0 || left + rect.width < 0) return;
      if (top > rootRect.height || left > rootRect.width) return;
      const tag = node.tagName;
      const isBlock = BLOCK_TAGS.has(tag);
      const isInline = INLINE_TAGS.has(tag);
      if (isBlock || isInline) {
        shapes.push({
          top: Math.max(0, top),
          left: Math.max(0, left),
          width: Math.min(rect.width, rootRect.width - Math.max(0, left)),
          height: Math.min(rect.height, rootRect.height - Math.max(0, top)),
          radius: getRadius(node),
        });
        if (isBlock) return; // Treat replaced content and controls as leaf shapes.
      }

      for (const child of node.children) visit(child);
    };

    for (const child of root.children) visit(child);
    return Skeleton.removeContainedShapes(shapes);
  }

  /**
   * Discard shapes fully contained by a larger shape.
   */
  static removeContainedShapes(shapes) {
    return shapes.filter(
      (a, i) =>
        !shapes.some((b, j) => {
          if (i === j) return false;
          const inside =
            a.top >= b.top &&
            a.left >= b.left &&
            a.top + a.height <= b.top + b.height &&
            a.left + a.width <= b.left + b.width;
          return inside && b.width * b.height > a.width * a.height;
        }),
    );
  }

  /**
   * Remove generated loading and error overlays within the target.
   */
  static removeOverlay(el) {
    el.querySelectorAll("[data-skeleton-injected]").forEach((n) => n.remove());
  }

  /**
   * Clear the error attributes and remove the error layer.
   */
  static clearError(el) {
    el.removeAttribute("data-skeleton-error");
    el.removeAttribute("aria-live");
    el.querySelectorAll(".hygular-sk-error-layer").forEach((n) => n.remove());
  }

  /**
   * Restore the aria-hidden and aria-label values saved before loading.
   */
  static restoreAria(el) {
    el.skeletonAriaHidden === null
      ? el.removeAttribute("aria-hidden")
      : el.setAttribute("aria-hidden", el.skeletonAriaHidden);
    el.skeletonAriaLabel === null
      ? el.removeAttribute("aria-label")
      : el.setAttribute("aria-label", el.skeletonAriaLabel);
  }

  /**
   * Dispatch a skeleton event and return whether it was canceled.
   */
  static _emit(el, name, cancelable = false, detail = {}) {
    const ev = new CustomEvent(name, {
      bubbles: true,
      cancelable,
      detail: { el, ...detail },
    });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }

  /**
   * Create an element with the supplied class and attributes.
   */
  static _createElement(tag, cls = "", attrs = {}) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  /**
   * Build the SVG icon used by the error layer.
   */
  static createErrorIcon() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    const set = (el, attrs) => {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };
    const mk = (tag, attrs) => set(document.createElementNS(ns, tag), attrs);

    set(svg, {
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    });

    svg.appendChild(mk("circle", { cx: "12", cy: "12", r: "10" }));
    svg.appendChild(mk("line", { x1: "12", y1: "8", x2: "12", y2: "12" }));
    svg.appendChild(mk("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" }));
    return svg;
  }
}

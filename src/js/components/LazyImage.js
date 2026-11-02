/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

export default class LazyImage {
  static #loading = new WeakSet();
  /**
   * Load the deferred image with a shimmer placeholder and an error fallback.
   */
  static load(img) {
    if (!img?.dataset.src || !img.parentNode || LazyImage.#loading.has(img))
      return;
    LazyImage.#loading.add(img);

    const errorText = img.dataset.errorText || "Image failed to load";

    const wrap = document.createElement("div");
    wrap.className = "hygular-image-wrap";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    const shimmer = document.createElement("div");
    shimmer.className = "hygular-image-shimmer";
    wrap.appendChild(shimmer);

    const errorLayer = document.createElement("div");
    errorLayer.className = "hygular-image-error-layer";
    errorLayer.appendChild(LazyImage.createErrorSVG());
    const span = document.createElement("span");
    span.textContent = errorText;
    errorLayer.appendChild(span);
    wrap.appendChild(errorLayer);

    const temp = new Image();

    temp.onload = () => {
      LazyImage.#loading.delete(img);
      img.src = temp.src;
      img.removeAttribute("data-src");
      img.classList.add("hygular-image-loaded");
      shimmer.remove();
    };

    temp.onerror = () => {
      LazyImage.#loading.delete(img);
      temp.onerror = null;
      shimmer.remove();
      img.removeAttribute("data-src");
      errorLayer.classList.add("is-visible");
    };

    temp.src = img.dataset.src;
  }

  /**
   * Observe existing and newly inserted images and load them as they approach the
   * viewport. Return a function that disconnects both observers.
   */
  static observe(selector = "img[data-src]") {
    if (typeof window === "undefined" || typeof document === "undefined")
      return () => {};
    let disposed = false;
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (disposed) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            LazyImage.load(entry.target);
            intersectionObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "100px 0px", threshold: 0.1 },
    );

    document
      .querySelectorAll(selector)
      .forEach((img) => intersectionObserver.observe(img));

    const mutationObserver = new MutationObserver((mutations) => {
      if (disposed) return;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches?.(selector)) intersectionObserver.observe(node);
          node
            .querySelectorAll?.(selector)
            .forEach((img) => intersectionObserver.observe(img));
        });
      });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      disposed = true;
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
    };
  }

  /**
   * Build the SVG icon used by the image error fallback.
   */
  static createErrorSVG() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "3");
    rect.setAttribute("y", "3");
    rect.setAttribute("width", "18");
    rect.setAttribute("height", "18");
    rect.setAttribute("rx", "2");

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", "8.5");
    circle.setAttribute("cy", "8.5");
    circle.setAttribute("r", "1.5");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "m21 15-5-5L5 21");

    svg.appendChild(rect);
    svg.appendChild(circle);
    svg.appendChild(path);
    return svg;
  }
}

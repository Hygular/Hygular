/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect, useRef } from "react";
import Components from "../js/core/Component.js";

/**
 * Initialize tab behavior for the returned ref and dispose it on unmount.
 */
export function useTabview() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const instance = Components.tabview(el);

    return () => {
      instance?.dispose?.();
    };
  }, []);

  return ref;
}

/**
 * Enable pointer dragging for the returned ref and detach it on unmount.
 */
export function useSwiper() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const instance = Components.swiper(el);

    return () => {
      instance?.dispose?.();
    };
  }, []);

  return ref;
}

/**
 * Reformat the element's data-count value whenever count changes.
 */
export function useBadge(count) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    Components.badge(el);
  }, [count]);

  return ref;
}

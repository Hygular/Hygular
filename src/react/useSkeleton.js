/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect, useRef, useCallback } from "react";
import Skeleton from "../js/components/Skeleton.js";

/**
 * Return a target ref and helpers for loading, error, and async task states.
 */
export function useSkeleton() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.hasAttribute("data-skeleton")) {
      Skeleton.show(el);
    }
    return () => {
      Skeleton.hide(el);
    };
  }, []);

  const show = useCallback(() => {
    if (ref.current) Skeleton.show(ref.current);
  }, []);

  const hide = useCallback(() => {
    if (ref.current) Skeleton.hide(ref.current);
  }, []);

  const error = useCallback((opts = {}) => {
    if (ref.current) Skeleton.error(ref.current, opts);
  }, []);

  const wrap = useCallback((asyncFn, opts = {}) => {
    if (ref.current) return Skeleton.wrap(ref.current, asyncFn, opts);
  }, []);

  return { ref, show, hide, error, wrap };
}

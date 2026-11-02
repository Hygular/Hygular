/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect, useRef, useCallback } from "react";
import Carousel from "../js/components/Carousel.js";

/**
 * Initialize a carousel on mount and dispose it on unmount. Return its ref and
 * navigation helpers.
 */
export function useCarousel(target = null, options = {}) {
  const instanceRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    const carouselTarget = target?.current ?? target ?? ref.current;

    const instance = Carousel.create(carouselTarget, options);
    if (!instance) return;

    instanceRef.current = instance;

    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  const next = useCallback(() => {
    instanceRef.current?.next();
  }, []);

  const prev = useCallback(() => {
    instanceRef.current?.prev();
  }, []);

  const go = useCallback((index) => {
    instanceRef.current?.go(index);
  }, []);

  return { ref, next, prev, go };
}

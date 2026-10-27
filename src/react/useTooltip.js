/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect, useRef } from "react";
import Tooltip from "../js/components/Tooltip.js";

/**
 * Return a target ref and manage its tooltip instance on mount and unmount.
 */
export function useTooltip(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const instance = new Tooltip(el, options);

    return () => instance?.dispose?.();
  }, []);

  return ref;
}

/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect, useRef } from "react";
import Popover from "../js/components/Popover.js";

/**
 * Return a target ref and manage its popover instance on mount and unmount.
 */
export function usePopover(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const instance = new Popover(el, options);

    return () => instance?.dispose?.();
  }, []);

  return ref;
}

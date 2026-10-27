/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useCallback } from "react";
import Toast from "../js/components/Toast.js";

/**
 * Return stable helpers for showing toasts with optional status presets.
 */
export function useToast() {
  const success = useCallback((message, options = {}) => {
    return Toast.show({ ...options, message, status: "success" });
  }, []);

  const danger = useCallback((message, options = {}) => {
    return Toast.show({ ...options, message, status: "danger" });
  }, []);

  const warning = useCallback((message, options = {}) => {
    return Toast.show({ ...options, message, status: "warning" });
  }, []);

  const info = useCallback((message, options = {}) => {
    return Toast.show({ ...options, message, status: "info" });
  }, []);

  const show = useCallback((options = {}) => {
    return Toast.show(options);
  }, []);

  return { success, danger, warning, info, show };
}

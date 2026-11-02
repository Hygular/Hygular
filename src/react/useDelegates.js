/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect } from "react";
import Components from "../js/core/Component.js";
import Form from "../js/components/Form.js";

/**
 * Register navbar handlers on mount and remove them on unmount.
 */
export function useNavbar() {
  useEffect(() => {
    const dispose = Components.navbar();
    return () => dispose?.();
  }, []);
}

/**
 * Register drawer behavior on mount and run its cleanup on unmount.
 */
export function useDrawer() {
  useEffect(() => {
    const dispose = Components.drawer();
    return () => dispose?.();
  }, []);
}

/**
 * Register dropdown handlers on mount and remove them on unmount.
 */
export function useDropdown() {
  useEffect(() => {
    const dispose = Components.dropdown();
    return () => dispose?.();
  }, []);
}

/**
 * Register collapse handlers on mount and remove them on unmount.
 */
export function useCollapse() {
  useEffect(() => {
    const dispose = Components.collapse();
    return () => dispose?.();
  }, []);
}

/**
 * Register accordion handlers on mount and remove them on unmount.
 */
export function useAccordion() {
  useEffect(() => {
    const dispose = Components.accordion();
    return () => dispose?.();
  }, []);
}

/**
 * Register delegated alert dismissal on mount and remove the handler on unmount.
 */
export function useAlertDismiss() {
  useEffect(() => {
    const dispose = Components.alert();
    return () => dispose?.();
  }, []);
}

/**
 * Register form validation and submission handlers on mount and run cleanup on
 * unmount.
 */
export function useForm() {
  useEffect(() => {
    const dispose = Form.init();
    return () => dispose?.();
  }, []);
}

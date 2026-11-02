/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

export default class DelegateRegistry {
  static #documents = new WeakMap();

  /** Share listeners; refresh new markup for each subscriber. */
  static subscribe(name, bind) {
    if (typeof document === "undefined") return () => {};

    const ownerDocument = document;
    let state = DelegateRegistry.#documents.get(ownerDocument);
    if (!state) {
      state = { bindings: new Map(), observer: null };
      DelegateRegistry.#documents.set(ownerDocument, state);
    }
    const { bindings } = state;

    let binding = bindings.get(name);
    if (!binding) {
      const handlers = bind(ownerDocument);
      binding = {
        subscribers: 0,
        dispose: typeof handlers === "function" ? handlers : handlers.dispose,
        refresh: handlers.refresh,
        refreshing: false,
      };
      bindings.set(name, binding);
    }
    binding.subscribers++;

    if (binding.refresh && !state.observer) {
      state.observer = new ownerDocument.defaultView.MutationObserver(
        (records) => {
          if (
            !records.some((record) =>
              [...record.addedNodes].some((node) => node.nodeType === 1),
            )
          )
            return;
          for (const current of [...bindings.values()]) {
            if (current.subscribers) DelegateRegistry.#refresh(current);
          }
        },
      );
      state.observer.observe(ownerDocument.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    let disposed = false;
    const unsubscribe = () => {
      if (disposed) return;
      disposed = true;
      if (--binding.subscribers === 0) {
        bindings.delete(name);
        if (!bindings.size) {
          state.observer?.disconnect();
          DelegateRegistry.#documents.delete(ownerDocument);
        }
        binding.dispose();
      }
    };
    try {
      DelegateRegistry.#refresh(binding);
    } catch (error) {
      unsubscribe();
      throw error;
    }
    return unsubscribe;
  }

  static #refresh(binding) {
    // DOM initialization can invoke application callbacks synchronously.
    if (!binding.refresh || binding.refreshing) return;
    binding.refreshing = true;
    try {
      binding.refresh();
    } finally {
      binding.refreshing = false;
    }
  }
}

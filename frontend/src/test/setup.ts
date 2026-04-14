import "@testing-library/jest-dom";

/**
 * Some Node/Vitest setups expose a broken `localStorage` (e.g. missing setItem).
 * Use an in-memory Storage so auth and notification tests can run deterministically.
 */
function ensureWorkingLocalStorage() {
  if (typeof window === "undefined") return;

  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  let useMemory = false;
  try {
    if (typeof window.localStorage?.setItem !== "function") {
      useMemory = true;
    } else {
      window.localStorage.setItem("__vitest_ls_probe", "1");
      window.localStorage.removeItem("__vitest_ls_probe");
    }
  } catch {
    useMemory = true;
  }

  if (useMemory) {
    Object.defineProperty(window, "localStorage", {
      value: memory,
      configurable: true,
      writable: true,
    });
  }
}

ensureWorkingLocalStorage();

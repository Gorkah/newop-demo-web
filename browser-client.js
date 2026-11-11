/* Adaptador de la edición pública de NEW OP. Cada navegador tiene sus propios datos de demostración. */
(() => {
  'use strict';
  function createClient() {
    const key = 'newop-pages-v4';
    const storage = {
      getItem: () => localStorage.getItem(key),
      setItem: (_, value) => localStorage.setItem(key, value)
    };
    const serverNow = () => new Date().toISOString();
    const openStore = () => NewopDemo.createStore({storage, now: serverNow});
    const success = data => ({ok: true, data});
    const failure = (code, message) => ({ok: false, error: {code, message}});
    const snapshot = store => ({
      state: store.getState(),
      storage: {mode: 'browser', persistent: true},
      canImport: false
    });
    return {
      serverNow,
      session: async () => success({authenticated: true, mode: 'browser'}),
      state: async () => success(snapshot(openStore())),
      command: async ({command, expectedRevision}) => {
        const store = openStore();
        if (store.getState().revision !== expectedRevision) {
          return failure('REVISION_CONFLICT', 'Les dades han canviat en una altra pestanya.');
        }
        const result = store.dispatch(command);
        if (!result.ok) return result;
        if (store.getStorageStatus().mode !== 'persistent') {
          return failure('STORAGE_ERROR', 'El navegador no ha pogut desar els canvis.');
        }
        return success({...snapshot(store), result});
      }
    };
  }
  globalThis.NewopAI = {createClient};
})();

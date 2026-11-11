/* NEW OP · Cache de lectura; totes les escriptures es validen i es desen al servidor. */
(function () {
  'use strict';
  const failure = (code, message, field = null) => ({ok:false,error:{code,message,field}});
  const clone = value => JSON.parse(JSON.stringify(value));
  const newKey = () => 'cmd-' + (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function' ? globalThis.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function createStore({engine = globalThis.NewopDemo, client = globalThis.NewopAI && globalThis.NewopAI.createClient()} = {}) {
    if (!engine || !client) throw new Error('Falten el motor o el client del servidor.');
    let state = null, queryStore = null, storage = null, canImport = false, pending = null, pendingImport = null;
    function accept(data) {
      if (!data || !data.storage || data.storage.persistent !== true) return failure('INVALID_RESPONSE','El servidor no ha confirmat l’emmagatzematge persistent.');
      const checked = engine.validateState(data.state,{allowRealContacts:true});
      if (!checked.ok) return failure('INVALID_RESPONSE','L’estat rebut del servidor no és vàlid. No s’ha canviat la còpia anterior.');
      const raw = JSON.stringify(checked.data);
      queryStore = engine.createStore({allowRealContacts:true,storage:{getItem:() => raw,setItem:() => {throw new Error('Read-only cache');}}});
      state = checked.data;
      storage = clone(data.storage);
      if (typeof data.canImport === 'boolean') canImport = data.canImport;
      return {ok:true,data:clone(data)};
    }
    async function refresh(options) {
      const result = await client.state(options);
      return result.ok ? accept(result.data) : result;
    }
    async function dispatch(command) {
      if (!state) return failure('STATE_UNAVAILABLE','Primer cal carregar les dades del servidor.');
      const signature = JSON.stringify({command,expectedRevision:state.revision});
      if (!pending || pending.signature !== signature) pending = {signature,key:newKey()};
      const result = await client.command({command,expectedRevision:state.revision,idempotencyKey:pending.key});
      if (!result.ok) {
        // Transport, timeout or storage errors can conceal a committed command.
        // Preserve its key for a deliberate retry; never retry automatically.
        if (!['NETWORK_UNAVAILABLE','ABORTED','INVALID_RESPONSE','TIMEOUT','STORAGE_UNAVAILABLE','STORAGE_ERROR','UNAVAILABLE'].includes(result.error.code)) pending = null;
        return result;
      }
      const accepted = accept(result.data);
      if (!accepted.ok) return accepted;
      pending = null;canImport = false;
      const value = result.data.result;
      return value && typeof value.ok === 'boolean' ? value : {ok:true,data:clone(value === undefined ? result.data.state : value)};
    }
    async function importState(candidate) {
      if (!state || !canImport) return failure('IMPORT_NOT_ALLOWED','Aquest espai ja conté canvis. No se substituiran les dades del servidor.');
      const checked = engine.validateState(candidate,{allowRealContacts:true});
      if (!checked.ok) return checked;
      const signature = JSON.stringify({state:checked.data,expectedRevision:state.revision});
      if (!pendingImport || pendingImport.signature !== signature) pendingImport = {signature,key:newKey()};
      const result = await client.importState({state:checked.data,expectedRevision:state.revision,confirmed:true,idempotencyKey:pendingImport.key});
      if (!result.ok) return result;
      const accepted = accept(result.data);
      if (accepted.ok) {canImport = false;pending = null;pendingImport = null;}
      return accepted;
    }
    return {
      refresh,dispatch,importState,
      isReady:() => state !== null,
      getState:() => state ? clone(state) : null,
      canImport:() => canImport,
      getStorageStatus:() => storage ? clone(storage) : {mode:'unavailable',persistent:false},
      query:request => queryStore ? queryStore.query(request) : failure('STATE_UNAVAILABLE','No hi ha cap estat carregat del servidor.')
    };
  }
  const api = {createStore};
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.NewopServerStore = api;
})();

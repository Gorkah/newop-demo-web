/* Adaptador de la edición pública de NEW OP. Cada navegador tiene sus propios datos de demostración. */
(() => {
  'use strict';
  function createClient() {
    const key = 'newop-pages-v4';
    const storage = {
      getItem: () => localStorage.getItem(key),
      setItem: (_, value) => localStorage.setItem(key, value)
    };
    const filesKey = key + '-images';
    const readFiles = () => JSON.parse(localStorage.getItem(filesKey) || '{}');
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp'];
    function decode(content) {
      return Uint8Array.from(atob(content), char => char.charCodeAt(0));
    }
    function matchesImage(bytes, type) {
      if (type === 'application/pdf') return String.fromCharCode(...bytes.subarray(0,5)) === '%PDF-';
      if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
      const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start,end));
      return ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP';
    }
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
      async uploadAttachment({filename, mimeType, contentBase64, expectedRevision, idempotencyKey}, {signal} = {}) {
        if (![...allowedImages,'application/pdf'].includes(mimeType) || typeof contentBase64 !== 'string' || contentBase64.length > 1398104) {
          return failure('INVALID_FILE','Tria una foto JPEG, PNG, WebP o un PDF de fins a 1 MiB.');
        }
        let bytes;
        try {bytes = decode(contentBase64);} catch (_) {return failure('INVALID_FILE','La foto no es pot llegir.');}
        if (!matchesImage(bytes,mimeType) || bytes.length > 1048576) return failure('INVALID_FILE','El format de la foto no coincideix amb el fitxer.');
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2,'0')).join('');
        if (signal?.aborted) return failure('ABORTED','Operació cancel·lada.');
        const state = openStore().getState();
        const id = 'att-' + idempotencyKey;
        const existing = state.workflow?.attachments.find(file => file.id === id);
        if (existing?.sha256 === sha256) return success({attachment:existing});
        if (state.revision !== expectedRevision || existing) return failure('REVISION_CONFLICT','Les dades han canviat. Torna a seleccionar la foto.');
        state.workflow ||= {version:1,clientNotes:[],meetings:[],attachments:[],workshopEntries:[],purchases:[],billingProfiles:[],proformas:[],receipts:[],creditAllocations:[],quoteEvents:[]};
        const attachment = {id,filename,mimeType,sizeBytes:bytes.length,sha256,createdAt:serverNow()};
        state.workflow.attachments.push(attachment);
        state.revision++;
        if (!NewopDemo.validateState(state).ok) return failure('INVALID_FILE','Revisa el nom i la mida de la foto.');
        try {
          const files = readFiles();
          files[id] = contentBase64;
          localStorage.setItem(filesKey, JSON.stringify(files));
          storage.setItem(key, JSON.stringify(state));
        } catch (_) {return failure('STORAGE_ERROR','El navegador no ha pogut desar la foto. Comprova l’espai disponible.');}
        return success({attachment});
      },
      imageSource({id,mimeType}) {
        if (!allowedImages.includes(mimeType)) return null;
        try {
          const data=readFiles()[id];
          return typeof data==='string' && /^[A-Za-z0-9+/]+=*$/.test(data) ? 'data:'+mimeType+';base64,'+data : null;
        } catch (_) {return null;}
      },
      async downloadAttachment(id) {
        const attachment = openStore().getState().workflow?.attachments.find(file => file.id === id);
        const data = readFiles()[id];
        return attachment && data ? success({blob:new Blob([decode(data)],{type:attachment.mimeType})}) : failure('NOT_FOUND','La foto no està disponible en aquest navegador.');
      },
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
        if (command.type === 'RESET') localStorage.removeItem(filesKey);
        return success({...snapshot(store), result});
      }
    };
  }
  globalThis.NewopAI = {createClient};
})();

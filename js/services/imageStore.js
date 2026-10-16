(function (global) {
  "use strict";

  var DB_NAME = "leitner-images";
  var DB_VERSION = 1;
  var STORE = "images";
  var MAX_BLOB_BYTES = 2 * 1024 * 1024; // 2 Mo par image
  var MAX_TOTAL_HINT = 200 * 1024 * 1024; // avertissement indicatif

  var dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = global.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: "id" });
          }
        };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function (e) { reject(req.error || new Error("IndexedDB indisponible")); };
      });
    }
    return dbPromise;
  }

  function tx(mode) {
    return open().then(function (db) {
      return db.transaction(STORE, mode).objectStore(STORE);
    });
  }

  function put(id, blob) {
    if (!id || typeof id !== "string") return Promise.reject(new Error("id requis"));
    if (!blob || typeof blob.size !== "number" || typeof blob.type !== "string") {
      return Promise.reject(new Error("blob invalide"));
    }
    if (blob.size > MAX_BLOB_BYTES) {
      return Promise.reject(new Error("Image trop volumineuse (" + Math.round(blob.size / 1024) + " Ko, max " + Math.round(MAX_BLOB_BYTES / 1024) + " Ko)"));
    }
    return tx("readwrite").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.put({ id: id, blob: blob, createdAt: Date.now() });
        req.onsuccess = function () { resolve(id); };
        req.onerror = function () { reject(req.error || new Error("écriture impossible")); };
      });
    });
  }

  function get(id) {
    return tx("readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.get(id);
        req.onsuccess = function () {
          var rec = req.result;
          resolve(rec ? rec.blob : null);
        };
        req.onerror = function () { reject(req.error || new Error("lecture impossible")); };
      });
    });
  }

  function remove(id) {
    return tx("readwrite").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.delete(id);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error || new Error("suppression impossible")); };
      });
    });
  }

  function list() {
    return tx("readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.getAllKeys();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error || new Error("liste impossible")); };
      });
    });
  }

  function estimateUsage() {
    if (!global.navigator || !global.navigator.storage || !global.navigator.storage.estimate) {
      return Promise.resolve(null);
    }
    return global.navigator.storage.estimate().then(function (est) {
      return est && typeof est.usage === "number" ? est : null;
    }).catch(function () { return null; });
  }

  function uuid() {
    if (typeof global.crypto !== "undefined" && global.crypto.randomUUID) {
      return global.crypto.randomUUID();
    }
    // Fallback RFC 4122 v4 (si crypto.randomUUID indisponible)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var api = {
    _resetForTests: function () { dbPromise = null; },
    uuid: uuid,
    DB_NAME: DB_NAME,
    STORE: STORE,
    MAX_BLOB_BYTES: MAX_BLOB_BYTES,
    open: open,
    put: put,
    get: get,
    remove: remove,
    list: list,
    estimateUsage: estimateUsage
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.ImageStore = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

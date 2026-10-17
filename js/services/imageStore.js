(function (global) {
  "use strict";

  var DB_NAME = "leitner-images";
  var DB_VERSION = 2;
  var STORE = "images";
  var SHA1_INDEX = "bySha1";
  var MAX_BLOB_BYTES = 2 * 1024 * 1024; // 2 Mo par image
  var MAX_TOTAL_HINT = 200 * 1024 * 1024; // avertissement indicatif

  var dbPromise = null;
  var sha1Migrated = false;

  function sha1Hex(buffer) {
    if (!global.crypto || !global.crypto.subtle) return Promise.resolve(null);
    return global.crypto.subtle.digest("SHA-1", buffer).then(function (hash) {
      var bytes = new Uint8Array(hash);
      var hex = "";
      for (var i = 0; i < bytes.length; i++) {
        hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
      }
      return hex;
    });
  }

  function blobSha1(blob) {
    if (blob && typeof blob.arrayBuffer === "function") {
      return blob.arrayBuffer().then(sha1Hex);
    }
    return Promise.resolve(null);
  }

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = global.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: "id" });
          }
          var store = e.target.transaction.objectStore(STORE);
          if (!store.indexNames.contains(SHA1_INDEX)) {
            store.createIndex(SHA1_INDEX, "sha1", { unique: false });
          }
        };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function (e) { reject(req.error || new Error("IndexedDB indisponible")); };
      }).then(function (db) {
        ensureSha1Migration();
        return db;
      });
    }
    return dbPromise;
  }

  // Complète les enregistrements créés avant l'index sha1 (best effort, une fois).
  function ensureSha1Migration() {
    if (sha1Migrated) return;
    sha1Migrated = true;
    tx("readwrite").then(function (store) {
      return new Promise(function (resolve) {
        var req = store.openCursor();
        req.onsuccess = function (e) {
          var cursor = e.target.result;
          if (!cursor) { resolve(); return; }
          var rec = cursor.value;
          if (rec && !rec.sha1 && rec.blob) {
            blobSha1(rec.blob).then(function (hex) {
              if (hex) {
                rec.sha1 = hex;
                cursor.update(rec).onsuccess = function () { cursor.continue(); };
              } else {
                cursor.continue();
              }
            }).catch(function () { cursor.continue(); });
          } else {
            cursor.continue();
          }
        };
        req.onerror = function () { resolve(); };
      });
    }).catch(function () {});
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
    return blobSha1(blob).then(function (hex) {
      return tx("readwrite").then(function (store) {
        return new Promise(function (resolve, reject) {
          var rec = { id: id, blob: blob, createdAt: Date.now() };
          if (hex) rec.sha1 = hex;
          var req = store.put(rec);
          req.onsuccess = function () { resolve(id); };
          req.onerror = function () { reject(req.error || new Error("écriture impossible")); };
        });
      });
    });
  }

  function findBySha1(hex) {
    if (!hex) return Promise.resolve(null);
    return tx("readonly").then(function (store) {
      return new Promise(function (resolve) {
        var idx = store.index(SHA1_INDEX);
        var req = idx.getAllKeys(hex);
        req.onsuccess = function () {
          var keys = req.result || [];
          resolve(keys.length > 0 ? keys[0] : null);
        };
        req.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  // Insère le blob sans dupliquer : si une image identique (même sha1)
  // existe déjà, réutilise son id. Résout { id, reused }.
  function putDedup(blob) {
    if (!blob || typeof blob.size !== "number" || typeof blob.type !== "string") {
      return Promise.reject(new Error("blob invalide"));
    }
    if (blob.size > MAX_BLOB_BYTES) {
      return Promise.reject(new Error("Image trop volumineuse (" + Math.round(blob.size / 1024) + " Ko, max " + Math.round(MAX_BLOB_BYTES / 1024) + " Ko)"));
    }
    return blobSha1(blob).then(function (hex) {
      return findBySha1(hex).then(function (existingId) {
        if (existingId) return { id: existingId, reused: true };
        var newId = uuid();
        return put(newId, blob).then(function () { return { id: newId, reused: false }; });
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
    _resetForTests: function () { dbPromise = null; sha1Migrated = false; },
    uuid: uuid,
    DB_NAME: DB_NAME,
    STORE: STORE,
    SHA1_INDEX: SHA1_INDEX,
    MAX_BLOB_BYTES: MAX_BLOB_BYTES,
    open: open,
    put: put,
    putDedup: putDedup,
    findBySha1: findBySha1,
    sha1Hex: sha1Hex,
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

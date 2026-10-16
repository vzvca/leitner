(function (global) {
  "use strict";
  var m = global.m;
  var CardMedia = global.CardMedia;
  var ImageStore = global.ImageStore;
  var ImageResize = global.ImageResize;

  function toast(store, msg) {
    store.toast = msg;
    store.toastKey = Date.now();
    clearTimeout(store._toastTimer);
    store._toastTimer = setTimeout(function () {
      store.toast = null;
      m.redraw();
    }, 2600);
  }

  var thumbCache = {};

  var ImagePicker = {
    oninit: function (vnode) {
      var s = vnode.state;
      s.store = vnode.attrs.store;
      s.value = vnode.attrs.value || "";        // "idb:uuid" | "img:images/…" | "img:https://…" | "img:data:…"
      s.onchange = vnode.attrs.onchange || function () {};
      s.busy = false;
      s.error = "";
      s.libraryOpen = false;
      s.library = null;
      s.libraryBusy = false;
      s.urlInput = "";
    },

    // — ingestion d'un fichier (upload, drop, paste) —
    ingestFile: function (s, file) {
      if (!file) return;
      if (!ImageResize.isResizableType(file.type)) {
        s.error = "Format non supporté (png, jpg, webp, gif).";
        m.redraw();
        return;
      }
      s.busy = true;
      s.error = "";
      ImageResize.resizeBlob(file, { maxDim: 1024 })
        .then(function (resized) {
          var id = ImageStore.uuid();
          return ImageStore.put(id, resized).then(function () {
            thumbCache[id] = null; // invalide
            s.value = "idb:" + id;
            s.onchange(s.value);
            toast(s.store, "Image enregistrée (" + Math.round(resized.size / 1024) + " Ko" +
              (resized.size < file.size ? ", redimensionnée depuis " + Math.round(file.size / 1024) + " Ko" : "") + ")");
          });
        })
        .catch(function (e) {
          s.error = e.message || String(e);
        })
        .finally(function () {
          s.busy = false;
          m.redraw();
        });
    },

    onPaste: function (s, ev) {
      var items = ev.clipboardData && ev.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image/") === 0) {
          var file = items[i].getAsFile();
          if (file) {
            ev.preventDefault();
            ImagePicker.ingestFile(s, file);
          }
          return;
        }
      }
    },

    addFromUrl: function (s) {
      var url = s.urlInput.trim();
      if (!/^https:\/\/[^\s"'<>]+$/.test(url)) {
        s.error = "URL invalide : doit être une URL https:// vers une image.";
        m.redraw();
        return;
      }
      s.error = "";
      s.value = "img:" + url;
      s.urlInput = "";
      s.onchange(s.value);
      toast(s.store, "Image liée par URL (aucune copie locale)");
      m.redraw();
    },

    loadLibrary: function (s) {
      s.libraryOpen = !s.libraryOpen;
      if (s.libraryOpen && !s.library && !s.libraryBusy) {
        s.libraryBusy = true;
        ImageStore.list().then(function (ids) {
          s.library = ids;
        }).catch(function () {
          s.error = "Impossible de lire la bibliothèque d'images.";
        }).finally(function () {
          s.libraryBusy = false;
          m.redraw();
        });
      }
    },

    pickFromLibrary: function (s, id) {
      s.value = "idb:" + id;
      s.libraryOpen = false;
      s.onchange(s.value);
      m.redraw();
    },

    view: function (vnode) {
      var s = vnode.state;
      return m(".image-picker", [
        // Aperçu
        s.value ? ImagePicker.preview(s) : null,

        // Zone de dépôt (upload / drag&drop / paste)
        m(".drop-zone", {
          tabindex: 0,
          style: "border:2px dashed var(--border); border-radius:8px; padding:1rem; text-align:center; cursor:pointer; outline:none;" +
            (s.busy ? "opacity:.5;" : ""),
          onclick: function () {
            var input = document.createElement("input");
            input.type = "file";
            input.accept = "image/png,image/jpeg,image/webp,image/gif";
            input.onchange = function (e) {
              ImagePicker.ingestFile(s, e.target.files && e.target.files[0]);
            };
            input.click();
          },
          ondragover: function (e) { e.preventDefault(); },
          ondrop: function (e) {
            e.preventDefault();
            var file = e.dataTransfer.files && e.dataTransfer.files[0];
            ImagePicker.ingestFile(s, file);
          },
          onpaste: function (e) { ImagePicker.onPaste(s, e); }
        }, [
          s.busy
            ? m("div.muted", "Traitement de l'image…")
            : [
                m("div", "📁 Déposer, coller (Ctrl+V) ou cliquer pour choisir une image"),
                m("div.muted", { style: "font-size:.85rem" }, "png, jpg, webp, gif — redimensionnée à 1024 px max avant stockage (IndexedDB)")
              ]
        ]),

        // URL https
        m("div", { style: "display:flex; gap:.5rem; margin-top:.6rem; flex-wrap:wrap" }, [
          m("input[type=text][placeholder='Ou URL https:// d\\'une image']", {
            style: "flex:1; min-width:12rem",
            value: s.urlInput,
            onchange: function (e) { s.urlInput = e.target.value; },
            onkeydown: function (e) { if (e.key === "Enter") { e.preventDefault(); ImagePicker.addFromUrl(s); } }
          }),
          m("button", { onclick: function () { ImagePicker.addFromUrl(s); } }, "Lier l'URL")
        ]),

        // Bibliothèque
        m("div", { style: "margin-top:.6rem" }, [
          m("button", { onclick: function () { ImagePicker.loadLibrary(s); } },
            s.libraryOpen ? "Masquer la bibliothèque" : "Choisir dans la bibliothèque (" + (s.library ? s.library.length : "…") + ")"),
          s.libraryOpen ? ImagePicker.libraryView(s) : null
        ]),

        s.error ? m("div", { style: "color:var(--danger); margin-top:.5rem" }, "⚠ " + s.error) : null
      ]);
    },

    preview: function (s) {
      var src = null;
      if (s.value.indexOf("idb:") === 0) {
        var id = CardMedia.idbId(s.value);
        if (id && thumbCache[id]) src = thumbCache[id];
      } else {
        src = CardMedia.imageSrc(s.value);
      }
      return m("div", { style: "margin-bottom:.6rem" }, [
        src
          ? m("img", {
              src: src, alt: "aperçu",
              style: "max-width:14rem; max-height:10rem; border-radius:8px; border:1px solid var(--border)"
            })
          : m("span.muted", s.value.indexOf("idb:") === 0 ? "Chargement de l'aperçu…" : s.value),
        m("div", { style: "display:flex; gap:.5rem; align-items:center; margin-top:.3rem" }, [
          m("span.muted", { style: "font-size:.8rem" }, s.value.split("\n")[0].slice(0, 60)),
          m("button", {
            onclick: function () { s.value = ""; s.onchange(""); m.redraw(); }
          }, "Retirer")
        ])
      ]);
    },

    libraryView: function (s) {
      if (s.libraryBusy) return m("div.muted", "Chargement…");
      if (!s.library || s.library.length === 0) {
        return m("div.muted", "Aucune image dans la bibliothèque.");
      }
      return m("div", { style: "display:flex; gap:.6rem; flex-wrap:wrap; margin-top:.5rem" },
        s.library.map(function (id) {
          return m(LibraryThumb, {
            key: id, id: id,
            onpick: function () { ImagePicker.pickFromLibrary(s, id); }
          });
        }));
    }
  };

  var LibraryThumb = {
    oninit: function (vnode) {
      vnode.state.url = null;
      ImageStore.get(vnode.attrs.id).then(function (blob) {
        if (blob) {
          vnode.state.url = URL.createObjectURL(blob);
          thumbCache[vnode.attrs.id] = vnode.state.url;
          m.redraw();
        }
      });
    },
    view: function (vnode) {
      return m("button", {
        onclick: vnode.attrs.onpick,
        style: "padding:0; border:1px solid var(--border); border-radius:6px; overflow:hidden; cursor:pointer; background:none"
      }, [
        vnode.state.url
          ? m("img", { src: vnode.state.url, alt: vnode.attrs.id, style: "width:5.5rem; height:5.5rem; object-fit:cover; display:block" })
          : m("div", { style: "width:5.5rem; height:5.5rem; display:flex; align-items:center; justify-content:center" }, "…")
      ]);
    }
  };

  global.ImagePicker = ImagePicker;
})(window);

(function (global) {
  "use strict";
  var m = global.m;
  var CardMedia = global.CardMedia;
  var ImageStore = global.ImageStore;

  var urlCache = {};   // id -> objectURL
  var inflight = {};  // id -> Promise

  function objectUrlFor(id) {
    if (urlCache[id]) return Promise.resolve(urlCache[id]);
    if (inflight[id]) return inflight[id];
    inflight[id] = ImageStore.get(id).then(function (blob) {
      delete inflight[id];
      if (!blob) throw new Error("Image introuvable (IndexedDB)");
      var url = URL.createObjectURL(blob);
      urlCache[id] = url;
      return url;
    }).catch(function (e) {
      delete inflight[id];
      throw e;
    });
    return inflight[id];
  }

  CardSide.resolve = objectUrlFor;

  function CardSide() {}

  CardSide.oninit = function (vnode) {
    vnode.state.idbUrl = null;
    vnode.state.idbError = "";
    var text = vnode.attrs.text || "";
    var id = CardMedia.idbId(text);
    if (id) {
      objectUrlFor(id)
        .then(function (url) {
          vnode.state.idbUrl = url;
          m.redraw();
        })
        .catch(function (e) {
          vnode.state.idbError = e.message || String(e);
          m.redraw();
        });
    }
  };

  CardSide.view = function (vnode) {
    var text = vnode.attrs.text || "";
    var caption = CardMedia.imageCaption(text);
    var size = vnode.attrs.size === "large";
    var imgStyle = size
      ? "max-width:100%; max-height:22rem; border-radius:8px; border:1px solid var(--border)"
      : "max-width:100%; max-height:5.5rem; border-radius:6px; border:1px solid var(--border)";

    var id = CardMedia.idbId(text);
    if (id) {
      if (vnode.state.idbError) {
        return m("span.math-error", "⚠ " + vnode.state.idbError);
      }
      if (!vnode.state.idbUrl) {
        return m("span.muted", "Chargement de l'image…");
      }
      return m("span.card-image", [
        m("img", { src: vnode.state.idbUrl, alt: caption || "image de la carte", loading: "lazy", style: imgStyle }),
        caption ? m("div.muted", { style: "font-size:.85rem" }, caption) : null
      ]);
    }

    if (CardMedia.isImageField(text)) {
      var src = CardMedia.imageSrc(text);
      if (!src) {
        return m("span.math-error", "Image non autorisée ou trop volumineuse");
      }
      return m("span.card-image", [
        m("img", { src: src, alt: caption || "image de la carte", loading: "lazy", style: imgStyle }),
        caption ? m("div.muted", { style: "font-size:.85rem" }, caption) : null
      ]);
    }
    return m(global.MathText, { text: text });
  };

  global.CardSide = CardSide;
})(window);

(function (global) {
  "use strict";

  var PREFIX = "img:";
  var IDB_PREFIX = "idb:";
  var MAX_DATA_URL_CHARS = 700000; // ~500 Ko binaire en base64

  function isImageField(text) {
    if (typeof text !== "string") return false;
    if (text.indexOf(PREFIX) === 0) return true;
    return idbId(text) !== null;
  }

  function idbId(text) {
    if (typeof text !== "string" || text.indexOf(IDB_PREFIX) !== 0) return null;
    var nl = text.indexOf("\n");
    var ref = (nl === -1 ? text : text.slice(0, nl)).slice(IDB_PREFIX.length).trim();
    return /^[A-Za-z0-9][A-Za-z0-9._\-]*$/.test(ref) ? ref : null;
  }

  function allowedSrc(ref) {
    var src = ref.slice(PREFIX.length).trim();
    if (!src) return null;
    if (src.indexOf("data:image/") === 0) {
      if (src.length > MAX_DATA_URL_CHARS) return null;
      if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(src)) {
        return null;
      }
      return src;
    }
    if (/^images\/[^\s"'<>?#&]+$/.test(src) && src.indexOf("..\/") === -1) return src;
    if (/^https:\/\/[^\s"'<>]+$/.test(src)) return src;
    return null;
  }

  function imageSrc(text) {
    if (!isImageField(text)) return null;
    var nl = text.indexOf("\n");
    var ref = (nl === -1 ? text : text.slice(0, nl));
    return allowedSrc(ref);
  }

  function imageCaption(text) {
    if (!isImageField(text)) return "";
    var nl = text.indexOf("\n");
    var first = nl === -1 ? text : text.slice(0, nl);
    var rest = nl === -1 ? "" : text.slice(nl + 1).trim();
    return rest;
  }

  function toImageField(src, caption) {
    var cap = (caption || "").trim();
    return PREFIX + src + (cap ? "\n" + cap : "");
  }

  var api = {
    PREFIX: PREFIX,
    IDB_PREFIX: IDB_PREFIX,
    isImageField: isImageField,
    isIdbField: function (text) { return idbId(text) !== null; },
    idbId: idbId,
    allowedSrc: allowedSrc,
    imageSrc: imageSrc,
    imageCaption: imageCaption,
    toImageField: toImageField
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.CardMedia = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

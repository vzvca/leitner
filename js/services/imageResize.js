(function (global) {
  "use strict";

  var DEFAULT_MAX_DIM = 1024;
  var DEFAULT_QUALITY = 0.85;
  var DEFAULT_FORMAT = "image/jpeg";

  function calculateDimensions(width, height, maxDim) {
    var max = maxDim || DEFAULT_MAX_DIM;
    if (!width || !height || width <= 0 || height <= 0) {
      return { width: 0, height: 0, scale: 0 };
    }
    var scale = Math.min(1, max / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      scale: scale
    };
  }

  function shouldResize(width, height, maxDim) {
    var max = maxDim || DEFAULT_MAX_DIM;
    return width > max || height > max;
  }

  function isResizableType(type) {
    return typeof type === "string" && /^image\/(png|jpe?g|webp|gif)$/.test(type);
  }

  // Redimensionne via canvas (navigateur). Résout avec le blob (éventuellement
  // ré-encodé) ; en cas d'échec du canvas, résout avec le blob d'origine.
  function resizeBlob(blob, options) {
    options = options || {};
    var maxDim = options.maxDim || DEFAULT_MAX_DIM;
    var quality = typeof options.quality === "number" ? options.quality : DEFAULT_QUALITY;
    var format = options.format || DEFAULT_FORMAT;
    var accept = global.createImageBitmap
      ? Promise.resolve(global.createImageBitmap(blob))
      : new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(blob);
          var img = new Image();
          img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image illisible")); };
          img.src = url;
        });

    return accept.then(function (bmp) {
      var w = bmp.width, h = bmp.height;
      var dims = calculateDimensions(w, h, maxDim);
      if (!shouldResize(w, h, maxDim)) {
        if (bmp.close) bmp.close();
        return blob;
      }
      var canvas = document.createElement("canvas");
      canvas.width = dims.width;
      canvas.height = dims.height;
      var ctx = canvas.getContext("2d");
      if (format === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, dims.width, dims.height);
      }
      ctx.drawImage(bmp, 0, 0, dims.width, dims.height);
      if (bmp.close) bmp.close();
      return new Promise(function (resolve) {
        canvas.toBlob(function (out) {
          resolve(out || blob);
        }, format, quality);
      });
    }).catch(function () {
      return blob;
    });
  }

  var api = {
    DEFAULT_MAX_DIM: DEFAULT_MAX_DIM,
    DEFAULT_QUALITY: DEFAULT_QUALITY,
    calculateDimensions: calculateDimensions,
    shouldResize: shouldResize,
    isResizableType: isResizableType,
    resizeBlob: resizeBlob
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.ImageResize = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

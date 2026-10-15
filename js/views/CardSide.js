(function (global) {
  "use strict";
  var m = global.m;
  var CardMedia = global.CardMedia;

  var CardSide = {
    view: function (vnode) {
      var text = vnode.attrs.text || "";
      if (CardMedia.isImageField(text)) {
        var src = CardMedia.imageSrc(text);
        var caption = CardMedia.imageCaption(text);
        if (!src) {
          return m("span.math-error", "Image non autorisée ou trop volumineuse");
        }
        return m("span.card-image", [
          m("img", {
            src: src,
            alt: caption || "image de la carte",
            loading: "lazy",
            style: vnode.attrs.size === "large"
              ? "max-width:100%; max-height:22rem; border-radius:8px; border:1px solid var(--border)"
              : "max-width:100%; max-height:5.5rem; border-radius:6px; border:1px solid var(--border)"
          }),
          caption ? m("div.muted", { style: "font-size:.85rem" }, caption) : null
        ]);
      }
      return m(global.MathText, { text: text });
    }
  };

  global.CardSide = CardSide;
})(window);

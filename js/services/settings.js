(function (global) {
  "use strict";

  var KEY_API = "leitner.settings.mistralApiKey";
  var KEY_MODEL = "leitner.settings.mistralModel";

  function Settings(storage) {
    this.storage = storage || null;
  }

  Settings.prototype.getApiKey = function () {
    return this.storage ? this.storage.getItem(KEY_API) || "" : "";
  };

  Settings.prototype.setApiKey = function (key) {
    if (this.storage) this.storage.setItem(KEY_API, String(key || "").trim());
  };

  Settings.prototype.getModel = function () {
    return this.storage ? this.storage.getItem(KEY_MODEL) || "" : "";
  };

  Settings.prototype.setModel = function (model) {
    if (this.storage) this.storage.setItem(KEY_MODEL, String(model || "").trim());
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Settings;
  } else {
    global.Settings = Settings;
  }
})(typeof window !== "undefined" ? window : globalThis);

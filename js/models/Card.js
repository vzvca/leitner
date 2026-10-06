(function (global) {
  "use strict";

  var nextIdCounter = 0;
  function nextId() {
    nextIdCounter += 1;
    return "c" + Date.now().toString(36) + "-" + nextIdCounter;
  }

  function Card(attrs) {
    attrs = attrs || {};
    this.id = attrs.id || nextId();
    this.deckId = attrs.deckId || null;
    this.front = attrs.front || "";
    this.back = attrs.back || "";
    this.box = typeof attrs.box === "number" ? attrs.box : 1;
    this.createdAt = attrs.createdAt || new Date().toISOString();
    this.dueDate = attrs.dueDate || null;
    this.correctCount = attrs.correctCount || 0;
    this.wrongCount = attrs.wrongCount || 0;
  }

  Card.prototype.isDue = function (referenceDate) {
    if (!this.dueDate) return true;
    var ref = toDayStart(referenceDate || new Date());
    var due = toDayStart(new Date(this.dueDate));
    return due.getTime() <= ref.getTime();
  };

  function toDayStart(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  Card.toDayStart = toDayStart;

  function toDateString(d) {
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  Card.toDateString = toDateString;

  Card.prototype.markCorrect = function (intervals, referenceDate) {
    var maxBox = intervals.length;
    if (this.box < maxBox) this.box += 1;
    this.correctCount += 1;
    this.dueDate = Card.dueDateFor(this.box, intervals, referenceDate);
    return this;
  };

  Card.prototype.markWrong = function (intervals, referenceDate) {
    this.box = 1;
    this.wrongCount += 1;
    this.dueDate = Card.dueDateFor(this.box, intervals, referenceDate);
    return this;
  };

  Card.dueDateFor = function (box, intervals, referenceDate) {
    var interval = intervals[box - 1];
    var base = Card.toDayStart(referenceDate || new Date());
    base.setDate(base.getDate() + interval);
    return Card.toDateString(base);
  };

  Card.todayString = function (referenceDate) {
    return Card.toDateString(Card.toDayStart(referenceDate || new Date()));
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Card;
  } else {
    global.Card = Card;
  }
})(typeof window !== "undefined" ? window : globalThis);

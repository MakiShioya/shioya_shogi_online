// script/skills/TimeWarp.js

const TimeWarp = {
  name: "時戻し",
  isSystemAction: true, // システム介入型フラグ
  endsTurn: false,
  maxUses: 1,

  buttonStyle: {
    backgroundColor: "#DAA520",
    color: "#FFFFFF",
    border: "2px solid #B8860B",
    width: "160px",
    height: "80px",
    fontSize: "20px",
    fontWeight: "bold"
  },

  canUse: function() {
    if (skillUseCount >= this.maxUses) return false;
    // 2手以上進んでいないと戻れない
    if (typeof history === 'undefined' || history.length < 2) return false;
    return true;
  },

  getValidTargets: function() {
    const targets = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        targets.push({ x: x, y: y });
      }
    }
    return targets;
  },

  execute: function(x, y) {
    // ★ここでは何もしません。
    // main.js 側で undoMove を呼んでもらいます。
    return "時を戻しました";
  }
};
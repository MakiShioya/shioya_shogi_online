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

  // 発動条件
  canUse: function() {
    // 1. 回数制限チェック
    if (skillUseCount >= this.maxUses) return false;

    // 2. 履歴チェック（2手以上進んでいないと戻れない）
    if (typeof history === 'undefined' || history.length < 2) return false;

    // ★★★ 追加：直前の手が「必殺技」だった場合は使えないようにする ★★★
    if (typeof kifu !== 'undefined' && kifu.length > 0) {
        // 相手が指した最後の手（棋譜の末尾）を取得
        const lastMove = kifu[kifu.length - 1];

        // 必殺技特有の文字列が含まれているかチェック
        // (計画) = BluePrint
        // (応援) = PassionateSupport
        // ★     = SilverArmor など（main.jsで技後に移動すると付くマーク）
        if (lastMove.includes("(計画)") || 
            lastMove.includes("(応援)") || 
            lastMove.includes("★")) {
            return false;
        }
    }

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

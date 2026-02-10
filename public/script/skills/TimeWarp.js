// script/skills/TimeWarp.js

const TimeWarp = {
  name: "時戻し",
  isSystemAction: true, // システム介入型フラグ
  endsTurn: false,
  // maxUses: 1,  <-- ★削除

  // ★新しいコスト設定（最強技なので高コスト）
  baseCost: 300,     // 初回300pt（かなり溜めないと使えない）
  costGrowth: 200,   // 2回目は800pt必要（実質連発不可能）

  buttonStyle: {
    backgroundColor: "#DAA520",
    color: "#FFFFFF",
    border: "2px solid #B8860B",
    width: "160px",
    height: "80px",
    fontSize: "20px",
    fontWeight: "bold"
  },

  // ★コスト計算（必須）
  getCost: function() {
    return this.baseCost + (skillUseCount * this.costGrowth);
  },

  // 発動条件
  canUse: function() {
    // 1. 手番チェック
    if (typeof myRole !== 'undefined') {
        if (turn !== myRole) return false;
    } else if (typeof cpuSide !== 'undefined') {
        if (turn === cpuSide) return false;
    }

    // ★2. コストチェック（ここを変更）
    if (typeof playerSkillPoint !== 'undefined') {
        if (playerSkillPoint < this.getCost()) return false;
    }

    // 3. 履歴チェック（2手以上進んでいないと戻れない）
    if (typeof history === 'undefined' || history.length < 2) return false;

    // 4. 直前の手が「必殺技」だった場合は使えないチェック
    if (typeof kifu !== 'undefined' && kifu.length > 0) {
        // 相手が指した最後の手（棋譜の末尾）を取得
        const lastMove = kifu[kifu.length - 1];

        // 必殺技特有の文字列が含まれているかチェック
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
    // 盤面全体を選択可能にする（どこを押しても発動）
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        targets.push({ x: x, y: y });
      }
    }
    return targets;
  },

  // 実行処理（変更なし）
  execute: function(x, y) {
    // 演出を再生
    if (typeof playSkillEffect === "function") {
        playSkillEffect("TimeWarp.PNG", ["TimeWarp.mp3", "skill.mp3"], "yellow");
    }

    // main.js 側で undoMove を呼んでもらいます。
    return "時を戻しました";
  }
};


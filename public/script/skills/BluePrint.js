// script/skills/BluePrint.js

const BluePrint = {
  name: "BluePrint",
  
  // ★設定
  endsTurn: false, 
  // maxUses: 1,  <-- 削除

  // ★新しいコスト設定
  baseCost: 50,      // 初回は50ポイントで発動可能（かなり軽い）
  costGrowth: 100,   // 使うたびに必要なポイントが100ずつ増える（50 -> 150 -> 250...）

  // ★デザイン
  buttonStyle: {
    backgroundColor: "#0000CD", 
    color: "#FFFFFF",
    border: "2px solid #191970", 
    width: "160px",
    height: "80px",
    fontSize: "20px",
    fontWeight: "bold"
  },

  // ★コスト計算メソッド（必須）
  getCost: function() {
    // skillUseCount（main.jsで管理されている使用回数）を使って計算
    // 初回は skillUseCount が 0 なので baseCost そのまま
    return this.baseCost + (skillUseCount * this.costGrowth);
  },

  // 発動条件
  canUse: function() {
    // 1. 手番チェック（自分の番か）
    if (typeof myRole !== 'undefined') {
        if (turn !== myRole) return false;
    } else if (typeof cpuSide !== 'undefined') {
        if (turn === cpuSide) return false;
    }

    // ★2. コストチェック（ポイントが足りているか）
    if (typeof playerSkillPoint !== 'undefined') {
        if (playerSkillPoint < this.getCost()) return false;
    }

    // 3. 履歴条件のチェック
    if (!this.checkHistoryCondition()) return false;
    
    // 4. ターゲットがあるか
    const targets = this.getValidTargets();
    return targets.length > 0;
  },

  // 履歴チェック機能（変更なし）
  checkHistoryCondition: function() {
    if (typeof kifu === 'undefined' || kifu.length === 0) return false;
    const limit = Math.min(kifu.length, 10);
    let targetMoves = [];
    if (turn === "black") {
      targetMoves = ["▲９八飛", "▲８八飛", "▲７八飛", "▲６八飛", "▲５八飛"];
    } else {
      targetMoves = ["△１二飛", "△２二飛", "△３二飛", "△４二飛", "△５二飛"];
    }
    for (let i = 0; i < limit; i++) {
      const line = kifu[i];
      if (targetMoves.some(m => line.includes(m))) {
        return true;
      }
    }
    return false;
  },

  // ターゲット取得（変更なし）
  getValidTargets: function() {
    const targets = [];
    const opponent = (turn === "black") ? "white" : "black";
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const piece = boardState[y][x];
        if (!piece) continue;
        const isWhite = (piece === piece.toLowerCase());
        if (turn === "black" && isWhite) continue;
        if (turn === "white" && !isWhite) continue;
        const base = piece.replace("+", "").toUpperCase();
        if (piece.includes("+")) continue;

        if (base === "R" || base === "B") {
            // 王手回避チェック
            const originalPiece = boardState[y][x];
            let promoted = "+" + base;
            if (turn === "white") promoted = promoted.toLowerCase();
            boardState[y][x] = promoted;
            const causesCheck = isKingInCheck(opponent);
            boardState[y][x] = originalPiece;

            if (causesCheck) continue;
            targets.push({ x: x, y: y });
        }
      }
    }
    return targets;
  },

  // 実行処理（変更なし）
  execute: function(x, y) {
    const piece = boardState[y][x];
    const baseUpper = piece.toUpperCase();
    let promoted = "+" + baseUpper;
    if (turn === "white") promoted = promoted.toLowerCase();
    boardState[y][x] = promoted;
    pieceStyles[y][x] = "green";
    window.isCaptureRestricted = true;

    if (typeof playSkillEffect === "function") {
       playSkillEffect("BluePrint.PNG", ["BluePrint.mp3", "skill.mp3"], "blue");
    }

    const files = ["９","８","７","６","５","４","３","２","１"];
    const ranks = ["一","二","三","四","五","六","七","八","九"];
    const mark = (turn === "black") ? "▲" : "△";
    return `${kifu.length + 1}手目：${mark}${files[x]}${ranks[y]}${pieceName[baseUpper]}成(計画)`;
  }
};

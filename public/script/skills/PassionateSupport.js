const PassionateSupport = {
  name: "PassionateSupport",
  
  // ★設定
  endsTurn: false, // 技を使っても手番が終わらない
  // maxUses: 2,   <-- ★削除

  // ★新しいコスト設定
  baseCost: 100,      // 初回コスト（手頃な設定）
  costGrowth: 200,    // 使うたびに40ずつ増える

  // ★デザイン
  buttonStyle: {
    backgroundColor: "#FF4500", 
    color: "#FFFFFF",
    border: "2px solid #8B0000",
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
    
    // 3. ターゲットがあるか
    const targets = this.getValidTargets();
    return targets.length > 0;
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
        
        // 成っている駒は除外
        if (piece.includes("+")) continue; 
        // 玉、金、飛車、角、歩は対象外（＝銀、桂、香のみ対象）
        if (["K", "G", "R", "B", "P"].includes(base)) continue; 

        // 王手回避チェック（技を使った瞬間に王手になるなら禁止）
        const originalPiece = boardState[y][x];
        let promoted = "+" + base;
        if (turn === "white") promoted = promoted.toLowerCase();
        boardState[y][x] = promoted;

        const causesCheck = isKingInCheck(opponent);
        boardState[y][x] = originalPiece;

        if (causesCheck) {
            continue;
        }

        targets.push({ x: x, y: y });
      }
    }
    return targets;
  },

  // 実行処理（変更なし）
  execute: function(x, y) {
    const piece = boardState[y][x];
    
    // 1. その場で成る
    const baseUpper = piece.toUpperCase();
    let promoted = "+" + baseUpper; 
    
    if (piece === piece.toLowerCase()) {
      promoted = promoted.toLowerCase();
    }
    boardState[y][x] = promoted;

    // 2. 緑色にする
    pieceStyles[y][x] = "green";

    // 3. 攻撃禁止フラグを立てる
    window.isCaptureRestricted = true;

    // 4. 演出
    if (typeof playSkillEffect === "function") {
       playSkillEffect("PassionateSupport.PNG", ["PassionateSupport.mp3", "skill.mp3"], "red"); 
    }

    // 5. 棋譜用文字列
    const files = ["９","８","７","６","５","４","３","２","１"];
    const ranks = ["一","二","三","四","五","六","七","八","九"];
    const mark = (turn === "black") ? "▲" : "△";
    
    return `${kifu.length + 1}手目：${mark}${files[x]}${ranks[y]}${pieceName[baseUpper]}成(応援)`;
  }
};

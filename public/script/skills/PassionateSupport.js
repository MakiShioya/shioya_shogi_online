// script/skills/PassionateSupport.js

const PassionateSupport = {
  name: "熱烈な応援",
  
  // ★設定
  endsTurn: false, // 技を使っても手番が終わらない
  maxUses: 2,      // 1局に2回まで使える

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

  // 発動条件
  canUse: function() {
    if (skillUseCount >= this.maxUses) return false;
    const targets = this.getValidTargets();
    return targets.length > 0;
  },

  // ターゲット取得
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
        if (["K", "G", "R", "B", "P"].includes(base)) continue; 

        // 王手チェック
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

  // 実行処理
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

    // ★★★ 追加：このターン、相手の駒を取ることを禁止するフラグを立てる ★★★
    window.isCaptureRestricted = true;

    // 3. 演出
    if (typeof playSkillEffect === "function") {
       playSkillEffect("PassionateSupport.PNG", ["PassionateSupport.mp3", "skill.mp3"], "red"); 
    }

    // 4. 棋譜用文字列
    const files = ["９","８","７","６","５","４","３","２","１"];
    const ranks = ["一","二","三","四","五","六","七","八","九"];
    const mark = (turn === "black") ? "▲" : "△";
    
    // ユーザーに制限を伝えるメッセージを含めるのも親切です
    return `${kifu.length + 1}手目：${mark}${files[x]}${ranks[y]}${pieceName[baseUpper]}成(応援)`;
  }
};

// script/skills/BluePrint.js

const BluePrint = {
  name: "必殺技",
  
  // ★設定
  endsTurn: false, // 手番は終わらない（手番消費なし）
  maxUses: 1,      // 1局に1回

  // ★デザイン（設計図のような青）
  buttonStyle: {
    backgroundColor: "#0000CD", // ミディアムブルー
    color: "#FFFFFF",
    border: "2px solid #191970", // ミッドナイトブルー
    width: "160px",
    height: "80px",
    fontSize: "20px",
    fontWeight: "bold"
  },

  // 発動条件
  canUse: function() {
    if (skillUseCount >= this.maxUses) return false;

    // 1. 履歴条件のチェック（10手目以内の振り飛車）
    if (!this.checkHistoryCondition()) return false;
    
    // 2. ターゲット（成れる飛車・角）があるか
    const targets = this.getValidTargets();
    return targets.length > 0;
  },

  // 履歴チェック機能
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

  // ターゲット取得（自分の飛車・角で、まだ成っていないもの）
  getValidTargets: function() {
    const targets = [];
    const opponent = (turn === "black") ? "white" : "black";
    
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const piece = boardState[y][x];
        if (!piece) continue;

        // 自分の駒か
        const isWhite = (piece === piece.toLowerCase());
        if (turn === "black" && isWhite) continue;
        if (turn === "white" && !isWhite) continue;

        const base = piece.replace("+", "").toUpperCase();
        
        // すでに成っている駒は除外
        if (piece.includes("+")) continue;

        // 飛車(R) または 角(B) のみが対象
        if (base === "R" || base === "B") {
            
            // ★追加ロジック：成った結果、相手の玉を取れる状態（王手）になるなら除外
            
            // 1. 仮に成らせてみる
            const originalPiece = boardState[y][x];
            let promoted = "+" + base;
            if (turn === "white") promoted = promoted.toLowerCase();
            boardState[y][x] = promoted;

            // 2. その状態で「相手の玉」が王手されているかチェック
            const causesCheck = isKingInCheck(opponent);

            // 3. 盤面を元に戻す（絶対に忘れないこと！）
            boardState[y][x] = originalPiece;

            // 4. 王手になってしまうなら、この駒は選べない
            if (causesCheck) {
                continue;
            }

            // 問題なければ候補に追加
            targets.push({ x: x, y: y });
        }
      }
    }
    return targets;
  },

  // 実行処理
  execute: function(x, y) {
    const piece = boardState[y][x];
    const baseUpper = piece.toUpperCase();

    // 1. 成る
    let promoted = "+" + baseUpper;
    if (turn === "white") promoted = promoted.toLowerCase();
    
    boardState[y][x] = promoted;

    // 2. 緑色にする
    pieceStyles[y][x] = "green";

    // ★★★ 追加：このターン、相手の駒を取ることを禁止するフラグを立てる ★★★
    window.isCaptureRestricted = true;

    // 3. 演出
    if (typeof playSkillEffect === "function") {
       playSkillEffect("BluePrint.PNG", ["BluePrint.mp3", "skill.mp3"], "blue");
    }

    // 4. 棋譜
    const files = ["９","８","７","６","５","４","３","２","１"];
    const ranks = ["一","二","三","四","五","六","七","八","九"];
    const mark = (turn === "black") ? "▲" : "△";
    
    return `${kifu.length + 1}手目：${mark}${files[x]}${ranks[y]}${pieceName[baseUpper]}成(計画)`;
  }
};

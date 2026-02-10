const SilverArmor = {
  name: "SilverArmor",
  
  // 状態管理用変数（そのまま）
  step: 0,        
  sourcePos: null,

  // ★コスト設定（守りの技なので安めに）
  baseCost: 100,
  costGrowth: 300,

  // デザイン設定（そのまま）
  buttonStyle: {
    backgroundColor: "#A9A9A9",
    color: "#FFFFFF",
    border: "2px solid #696969",
    width: "160px",
    height: "80px",
    fontSize: "20px",
    fontWeight: "bold"
  },

  // ★コスト計算（追加）
  getCost: function() {
    return this.baseCost + (skillUseCount * this.costGrowth);
  },

  // リセット処理（そのまま）
  reset: function() {
    this.step = 0;
    this.sourcePos = null;
    // オレンジ色のハイライトを消す処理
    for(let y=0; y<9; y++) {
        for(let x=0; x<9; x++) {
            if(pieceStyles[y][x] === "orange") pieceStyles[y][x] = null;
        }
    }
  },

  // 発動条件（修正）
  canUse: function() {
    // 1. 手番チェック
    if (typeof myRole !== 'undefined') {
        if (turn !== myRole) return false;
    } else if (typeof cpuSide !== 'undefined') {
        if (turn === cpuSide) return false;
    }

    // ★2. コストチェック（ここを書き換え）
    if (typeof playerSkillPoint !== 'undefined') {
        if (playerSkillPoint < this.getCost()) return false;
    }
    
    // 3. 自分の銀系駒があるか
    const allies = this.findAllies();
    return allies.length > 0;
  },

  // ターゲット取得（変更なし）
  getValidTargets: function() {
    // ステップ0：動かす駒（銀など）を選ばせる
    if (this.step === 0) {
        const allies = this.findAllies();
        const validAllies = [];

        // 全ての銀について、動かした後に王手にならないかチェック
        allies.forEach(src => {
            // 現在の状態を保存
            const originalStep = this.step;
            const originalSource = this.sourcePos;
            
            // 仮想的にこの駒を選んだことにしてチェック
            this.step = 1; // getSafeKingSurroundings が sourcePos を使うため
            this.sourcePos = src;
            
            const targets = this.getSafeKingSurroundings();
            
            // 元に戻す
            this.step = originalStep;
            this.sourcePos = originalSource;

            if (targets.length > 0) {
                validAllies.push(src);
            }
        });
        return validAllies;
    } 
    // ステップ1：移動先（玉の周り）を選ばせる
    else {
        return this.getSafeKingSurroundings();
    }
  },

  // 自分の銀・成銀・成桂・成香を探す（変更なし）
  findAllies: function() {
    const targets = [];
    const targetTypes = (turn === "black") 
      ? ["S", "+S", "+N", "+L"] 
      : ["s", "+s", "+n", "+l"]; // 後手の駒文字は小文字

    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        // ※ boardStateの文字と比較（小文字変換などはしない）
        if (targetTypes.includes(boardState[y][x])) {
          targets.push({ x, y });
        }
      }
    }
    return targets;
  },

  // 王手回避チェック付きの移動先取得（変更なし）
  getSafeKingSurroundings: function() {
    const targets = [];
    const king = (typeof findKing === 'function') ? findKing(turn) : null;
    if (!king) return [];
    if (!this.sourcePos) return []; 

    // 1. 玉の周囲の空きマス
    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = king.x + dx;
        const ny = king.y + dy;
        
        if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
          if (boardState[ny][nx] === "") {
            candidates.push({ x: nx, y: ny });
          }
        }
      }
    }

    // 2. 実際に動かして王手チェック
    const srcPiece = boardState[this.sourcePos.y][this.sourcePos.x];

    candidates.forEach(cand => {
        // 仮移動
        boardState[this.sourcePos.y][this.sourcePos.x] = ""; 
        boardState[cand.y][cand.x] = srcPiece;               

        if (!isKingInCheck(turn)) {
            targets.push(cand);
        }

        // 復元
        boardState[cand.y][cand.x] = "";
        boardState[this.sourcePos.y][this.sourcePos.x] = srcPiece;
    });

    return targets;
  },

  // 実行処理（変更なし）
  execute: function(x, y) {
    // --- ステップ0：駒を選んだとき ---
    if (this.step === 0) {
        this.sourcePos = { x, y };
        this.step = 1; 
        
        // 選択中の駒をオレンジ色に
        pieceStyles[y][x] = "orange";
        
        // ★重要：ステップ0の時点では技は完了していないので null を返す
        // メイン処理側で null が返ってきたら「手番交代なし＆ポイント消費なし」とみなす
        return null; 
    }

    // --- ステップ1：移動先を選んだとき ---
    const src = this.sourcePos;
    const piece = boardState[src.y][src.x]; 

    // 元の場所を消す
    boardState[src.y][src.x] = "";
    pieceStyles[src.y][src.x] = null; 

    // 新しい場所に置く
    boardState[y][x] = piece;
    
    // エフェクト用スタイル（緑色）
    pieceStyles[y][x] = "green";

    if (typeof playSkillEffect === "function") {
      playSkillEffect("SilverArmor.PNG", ["SilverArmor.mp3", "skill.mp3"], "silver");
    }

    // 完了処理
    this.step = 0;
    this.sourcePos = null;

    // 棋譜用文字列生成
    const files = ["９","８","７","６","５","４","３","２","１"];
    const ranks = ["一","二","三","四","五","六","七","八","九"];
    const mark = (turn === "black") ? "▲" : "△";
    
    // 駒名の日本語変換
    const pieceNames = {
        "S": "銀", "s": "銀", "+S": "成銀", "+s": "成銀",
        "+N": "成桂", "+n": "成桂", "+L": "成香", "+l": "成香"
    };
    // 万が一辞書になくてもそのまま表示
    const pName = pieceNames[piece] || pieceNames[piece.toUpperCase()] || "銀";
    
    const srcFile = 9 - src.x;
    const srcRank = src.y + 1;

    // 技完了の文字列を返す
    return `${moveCount + 1}手目：${mark}${files[x]}${ranks[y]}${pName}(${srcFile}${srcRank})★`;
  }
};

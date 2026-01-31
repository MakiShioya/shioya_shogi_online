const SilverArmor = {
  name: "シルバーアーマー",
  
  // 状態管理用変数
  step: 0,        // 0:駒選択待ち, 1:移動先選択待ち
  sourcePos: null,// 選んだ駒の座標

  // デザイン設定
  buttonStyle: {
    backgroundColor: "#A9A9A9",
    color: "#FFFFFF",
    border: "2px solid #696969",
    width: "160px",
    height: "80px",
    fontSize: "20px",
    fontWeight: "bold"
  },

  // リセット処理
  reset: function() {
    this.step = 0;
    this.sourcePos = null;
    for(let y=0; y<9; y++) {
        for(let x=0; x<9; x++) {
            if(pieceStyles[y][x] === "orange") pieceStyles[y][x] = null;
        }
    }
  },

  // 発動条件
  canUse: function() {
    if (skillUsed) return false;
    
    // 30手目以降でないと使えない（例）
    //if (moveCount < 30) return false;
    
    // 自分の銀系駒があるか
    const allies = this.findAllies();
    return allies.length > 0;
  },

  // ターゲット取得
  getValidTargets: function() {
    // ステップ0：動かす駒（銀など）を選ばせる
    if (this.step === 0) {
        // ★改良：移動後に「詰み」にならない駒だけを選べるようにする
        // （すべての移動先が反則になる駒は、そもそも選ばせない）
        const allies = this.findAllies();
        const validAllies = [];

        allies.forEach(src => {
            // この駒を動かしたとき、どこか1つでも安全な移動先があるか？
            // 仮想的に this.sourcePos をセットして検証
            const originalSource = this.sourcePos;
            this.sourcePos = src;
            const targets = this.getSafeKingSurroundings();
            this.sourcePos = originalSource; // 戻す

            if (targets.length > 0) {
                validAllies.push(src);
            }
        });
        return validAllies;
    } 
    // ステップ1：移動先（玉の周り）を選ばせる
    else {
        // ★改良：王手にならない場所だけを返す
        return this.getSafeKingSurroundings();
    }
  },

  // 自分の銀・成銀・成桂・成香を探す
  findAllies: function() {
    const targets = [];
    const targetTypes = (turn === "black") 
      ? ["S", "+S", "+N", "+L"] 
      : ["s", "+s", "+n", "+l"];

    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (targetTypes.includes(boardState[y][x])) {
          targets.push({ x, y });
        }
      }
    }
    return targets;
  },

  // ★新規追加：王手回避チェック付きの移動先取得
  getSafeKingSurroundings: function() {
    const targets = [];
    const king = findKing(turn);
    if (!king) return [];
    if (!this.sourcePos) return []; // 元の駒が決まってないと判定不可

    // 1. まず単純な空きマス候補を取得
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

    // 2. 候補ごとに「実際に動かしてみて王手にならないか」チェック
    // 現在の盤面を一時保存（ディープコピーではない簡易退避）
    const srcPiece = boardState[this.sourcePos.y][this.sourcePos.x];

    candidates.forEach(cand => {
        // 仮に動かす
        boardState[this.sourcePos.y][this.sourcePos.x] = ""; // 元を空に
        boardState[cand.y][cand.x] = srcPiece;               // 先に置く

        // 王手されていないかチェック
        // ※ rules.js の isKingInCheck 関数を使用
        if (!isKingInCheck(turn)) {
            targets.push(cand);
        }

        // 盤面を戻す
        boardState[cand.y][cand.x] = "";
        boardState[this.sourcePos.y][this.sourcePos.x] = srcPiece;
    });

    return targets;
  },

  // 玉の周囲の空きマスを探す（旧関数・念のため残す）
  getKingSurroundings: function() {
      // 内部的には安全版を呼ぶように変更
      return this.getSafeKingSurroundings();
  },

  // 実行処理
  execute: function(x, y) {
    // --- ステップ0：駒を選んだとき ---
    if (this.step === 0) {
        this.sourcePos = { x, y };
        this.step = 1; 
        
        pieceStyles[y][x] = "orange";
        return null; 
    }

    // --- ステップ1：移動先を選んだとき ---
    const src = this.sourcePos;
    const piece = boardState[src.y][src.x]; 

    boardState[src.y][src.x] = "";
    pieceStyles[src.y][src.x] = null; 

    boardState[y][x] = piece;
    pieceStyles[y][x] = "green";

    if (typeof playSkillEffect === "function") {
      playSkillEffect("SilverArmor.PNG", ["SilverArmor.mp3", "skill.mp3"], "silver");
    }

    this.step = 0;
    this.sourcePos = null;

    const files = ["９","８","７","６","５","４","３","２","１"];
    const ranks = ["一","二","三","四","五","六","七","八","九"];
    const mark = (turn === "black") ? "▲" : "△";
    
    const pieceNames = {
        "S": "銀", "s": "銀", "+S": "成銀", "+s": "成銀",
        "+N": "成桂", "+n": "成桂", "+L": "成香", "+l": "成香"
    };
    const pName = pieceNames[piece] || "銀";
    const srcFile = 9 - src.x;
    const srcRank = src.y + 1;

    // 手番は交代（endsTurn=true相当）
    return `${moveCount + 1}手目：${mark}${files[x]}${ranks[y]}${pName}(${srcFile}${srcRank})★`;
  }
};

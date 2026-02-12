// script/main.js (Standalone CPU Battle Version)

// --- DOM要素の取得 ---
const board = document.getElementById("board");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const resignBtn = document.getElementById("resignBtn");

// --- グローバル変数 ---
let lastSkillKifu = "";
let pendingMove = null;
let hasShownEndEffect = false;
window.skillUsed = false;
window.isCaptureRestricted = false;
let isCpuDoubleAction = false;
let cpuSkillUseCount = 0;


let playerSkillPoint = 0; // 現在の所持ポイント
let cpuSkillPoint = 0;
const MAX_SKILL_POINT = 1000; // ポイントの上限（任意）

const isFormalMode = localStorage.getItem('shogi_game_mode') === 'formal';
console.log("現在のモード(Main):", isFormalMode ? "ふぉーまる(必殺技なし)" : "かじゅある(必殺技あり)");


const SP_CONFIG = {
  MOVE: { "P": 5, "+P": 10, "L": 8, "+L": 13, "N": 8, "+N": 13, "S": 10, "+S": 15, "G": 10, "B": 15, "+B": 20, "R": 15, "+R": 20, "K": 20 },
  DROP: { "P": 10, "L": 13, "N": 13, "S": 15, "G": 15, "B": 20, "R": 20 },
  CAPTURE: { "P": 5, "+P": 10, "L": 8, "+L": 13, "N": 8, "+N": 13, "S": 10, "+S": 15, "G": 10, "B": 15, "+B": 20, "R": 15, "+R": 20, "K": 1000 },
  PROMOTE: { "P": 5, "L": 5, "N": 5, "S": 5, "B": 5, "R": 5 }
};


// --- 初期化処理 ---
window.addEventListener("load", () => {
  bgm = document.getElementById("bgm");
  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  if (resignBtn) resignBtn.addEventListener("click", resignGame);

  // ★★★ 1. 先手・後手のランダム決定 ★★★
  // Math.random() < 0.5 ならプレイヤーが先手(黒)、そうでなければ後手(白)
  const isPlayerBlack = Math.random() < 0.5;

  if (isPlayerBlack) {
      // プレイヤーが先手
      cpuSide = "white"; // CPUは後手
      // 画面の向きはそのまま
      document.body.classList.remove("view-white");
      updateHandLayout("black"); // 駒台配置：標準
      statusDiv.textContent = "対局開始！ あなたは【先手】です。";
  } else {
      // プレイヤーが後手
      cpuSide = "black"; // CPUは先手
      // 画面を反転させるクラスを追加
      document.body.classList.add("view-white");
      updateHandLayout("white"); // 駒台配置：反転（自分の台を右へ）
      statusDiv.textContent = "対局開始！ あなたは【後手】です。";
  }

  // 画像反映（反転クラス付与後に呼ぶことで影の向きなどが正しくなります）
  applyPlayerImage();

  // キャラのスキル設定
  const charId = sessionStorage.getItem('char_black') || 'default';
  if (charId === 'default' && typeof CharItsumono !== 'undefined') currentSkill = CharItsumono.skill;
  else if (charId === 'char_a' && typeof CharNekketsu !== 'undefined') currentSkill = CharNekketsu.skill;
  else if (charId === 'char_b' && typeof CharReisei !== 'undefined') currentSkill = CharReisei.skill;
  else if (charId === 'char_d' && typeof CharMachida !== 'undefined') currentSkill = CharMachida.skill;
  else currentSkill = null;

  updateSkillButton();
  playBGM();
  startTimer();
  
  // 初回描画
  render();
  
  if (typeof showKifu === "function") showKifu();

  // 千日手判定用の履歴初期化
  if (typeof getPositionKey === "function") {
      const key = getPositionKey();
      positionHistory[key] = 1;
  }

  // ★★★ 2. CPUが先手の場合、初手を指させる ★★★
  if (cpuSide === "black") {
      // 少し待ってから思考開始（いきなり動くとびっくりするため）
      setTimeout(() => cpuMove(), 1000);
  }

  firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            applyUserSkin();
        }
    });
});

// --- ★描画関数 (Hybrid: 画像+文字) ---
function render() {
  if (!board) return;

  // 勝敗・ステータス表示
  if (gameOver) {
    if (winner === "black") statusDiv.textContent = "先手の勝ちです！";
    else if (winner === "white") statusDiv.textContent = "後手の勝ちです！";
    else statusDiv.textContent = "引き分けです。";
    checkStatusDiv.textContent = "";

    if (typeof hasShownEndEffect !== 'undefined' && !hasShownEndEffect && winner) {
        window.playSkillEffect("shori.PNG", "shori.mp3", null);
        hasShownEndEffect = true; 
    }

    if (!document.getElementById("resetBtn")) {
       const btn = document.createElement("button");
       btn.id = "resetBtn";
       btn.textContent = "ホームに戻る"; 
       Object.assign(btn.style, {
           padding: "10px 20px", marginTop: "10px", fontSize: "16px",
           backgroundColor: "#d32f2f", color: "white", border: "none",
           borderRadius: "5px", cursor: "pointer"
       });
       btn.onclick = () => { window.location.href = "home.html"; };
       statusDiv.appendChild(document.createElement("br"));
       statusDiv.appendChild(btn);
    }
  } else {
    if (typeof isSkillTargeting !== 'undefined' && !isSkillTargeting) {
      let msg = "手番：" + (turn === "black" ? "先手" : "後手") + " / 手数：" + moveCount;
      if (window.isCaptureRestricted) msg += " 【攻撃禁止】";
      if (!statusDiv.textContent.includes("あなた")) {
          msg += (isKingInCheck(turn) ? "　王手！" : "");
          statusDiv.textContent = msg;
      }
    }
    checkStatusDiv.textContent = "";
  }

  // 盤面の生成
  board.innerHTML = "";
  for (let y = 0; y < 9; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < 9; x++) {
      const td = document.createElement("td");
      const piece = boardState[y][x];

      if (piece) {
        const isWhite = piece === piece.toLowerCase();
        const type = piece.startsWith("+") ? "+" + piece.replace("+","").toUpperCase() : piece.toUpperCase();
        const baseType = piece.replace("+", "").toUpperCase();
        const name = (typeof pieceName !== 'undefined') ? pieceName[type] : type;
        const isPromoted = type.startsWith("+");

        // ★駒のコンテナ作成（画像背景）
        const container = document.createElement("div");
        container.className = "piece-container";
        if (isWhite) {
            container.classList.add("gote");
        }
        container.classList.add("size-" + baseType);
        // 文字部分
        const textSpan = document.createElement("span");
        textSpan.className = "piece-text";
        if (isPromoted) textSpan.classList.add("promoted");
        
        // 1文字だけ表示（例：「成香」→「香」）
        textSpan.textContent = name.length > 1 ? name[name.length - 1] : name;

        // スキル演出（緑色）
        if (pieceStyles[y][x] === "green") {
          textSpan.style.color = "#32CD32";
          textSpan.style.textShadow = "1px 1px 2px #000";
        }

        container.appendChild(textSpan);
        td.appendChild(container);

        // 後手は180度回転
        if (isWhite) td.style.transform = "rotate(180deg)";
        
        // 直前の指し手ハイライト
        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) td.classList.add("moved");
      }
      // ★★★ ここを追加（移動元を赤くする） ★★★
      // 駒があるかどうかに関わらず、マス自体に色をつけるため if(piece){...} の外でもOKですが、
      // ここではわかりやすくループの最後の方に追加します
      if (lastMoveFrom && lastMoveFrom.x === x && lastMoveFrom.y === y) {
          td.classList.add("move-from");
      }
      // ★★★★★★★★★★★★★★★★★★★★★

      // 選択状態・移動可能範囲の表示
      if (selected && !selected.fromHand && selected.x === x && selected.y === y) td.classList.add("selected");
      if (typeof legalMoves !== 'undefined' && legalMoves.some(m => m.x === x && m.y === y)) td.classList.add("move");
      
      td.onclick = () => onCellClick(x, y);
      tr.appendChild(td);
    }
    board.appendChild(tr);
  }
  
  // 持ち駒の描画
  renderHands();

  // 持ち駒エリアの枠強調
  const blackBox = document.getElementById("blackHandBox");
  const whiteBox = document.getElementById("whiteHandBox");
  if (blackBox) blackBox.classList.remove("active");
  if (whiteBox) whiteBox.classList.remove("active");

  if (!gameOver) {
    if (turn === "black" && blackBox) blackBox.classList.add("active");
    else if (turn === "white" && whiteBox) whiteBox.classList.add("active");
  }
  
  updateSkillButton();
}

// --- 持ち駒描画関数 ---
function renderHands() {
  if (!blackHandDiv || !whiteHandDiv) return;
  const order = ["P", "L", "N", "S", "G", "B", "R"];
  if (typeof hands === 'undefined') return;

  hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  blackHandDiv.innerHTML = "";
  whiteHandDiv.innerHTML = "";

  const createHandPiece = (player, p, i) => {
      // ★持ち駒もコンテナ（div）で作成
      const container = document.createElement("div");
      container.className = "hand-piece-container";
      if (player === "white") {
          container.classList.add("gote");
      }
      const textSpan = document.createElement("span");
      textSpan.className = "piece-text";
      textSpan.textContent = (typeof pieceName !== 'undefined') ? pieceName[p] : p;

      container.appendChild(textSpan);

      // 選択状態
      if (selected && selected.fromHand && selected.player === player && selected.index === i) {
          container.classList.add("selected");
      }
      
      container.onclick = () => selectFromHand(player, i);

      // 持ち駒反転表示

      if (player === cpuSide) {
          container.style.transform = "rotate(180deg)";
      }

      return container;
  };

  hands.black.forEach((p, i) => blackHandDiv.appendChild(createHandPiece("black", p, i)));
  hands.white.forEach((p, i) => whiteHandDiv.appendChild(createHandPiece("white", p, i)));
}

// script/main.js の executeMove 関数

// ★グローバル変数（まだ追加していなければファイルの先頭に追加してください）


function executeMove(sel, x, y, doPromote) {
  // ▼▼▼ 【追加】CPUの必殺技発動チェック（指す直前） ▼▼▼
  // 条件：
  // 1. CPUの手番である（turn === cpuSide）
  // 2. まだ技を使っていない（!isCpuDoubleAction）
  // 3. 技ファイルが読み込まれている
  // 4. ゲーム中で、ポイントが足りている
  if (!gameOver && turn === cpuSide && !isCpuDoubleAction && typeof CpuDoubleAction !== 'undefined') {
      const cost = CpuDoubleAction.getCost();
      
      if (cpuSkillPoint >= cost) {
          // 発動処理
          consumeCpuSkillPoint(cost);
          isCpuDoubleAction = true; // フラグON
          cpuSkillUseCount++;

          // 演出
          playSkillEffect("boss_cutin.png", ["boss.mp3", "skill.mp3"], "dark");
          statusDiv.textContent = `CPUが必殺技【${CpuDoubleAction.name}】を発動！`;

          // ★重要：演出のために、実際の指し手を少し遅らせる
          // ここで一旦 return して、1.5秒後に「必殺技フラグが立った状態」で再度この関数を呼び直す
          setTimeout(() => {
              executeMove(sel, x, y, doPromote); 
          }, 1500);
          
          return; // 今回の処理はここで中断（演出待ち）
      }
  }
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  // --- 以下、元の executeMove の処理 ---

  history.push(deepCopyState());

  if (sel.fromHand) {
      lastMoveFrom = null;
  } else {
      lastMoveFrom = { x: sel.x, y: sel.y };
  }

  const pieceBefore = sel.fromHand
    ? hands[sel.player][sel.index]
    : boardState[sel.y][sel.x];
  const boardBefore = boardState.map(r => r.slice());
  const moveNumber = kifu.length + 1; 

  if (moveSound) {
    moveSound.currentTime = 0;
    moveSound.volume = 0.3;
    moveSound.play().catch(() => {});
  }

  // 盤面更新
  if (sel.fromHand) {
    const piece = hands[sel.player][sel.index];
    boardState[y][x] = sel.player === "black" ? piece : piece.toLowerCase();
    hands[sel.player].splice(sel.index, 1);
    pieceStyles[y][x] = null;
  } else {
    let piece = boardState[sel.y][sel.x];
    const target = boardState[y][x];
    
    if (target) {
        hands[turn].push(target.replace("+","").toUpperCase());
    }

    const isWhite = piece === piece.toLowerCase();
    const player = isWhite ? "white" : "black";
    const base = piece.replace("+","").toUpperCase();

    if (doPromote) {
      piece = promote(piece.toUpperCase());
      if (player === "white") piece = piece.toLowerCase();
      sel.promoted = true;

      if (promoteSound) {
        promoteSound.currentTime = 0;
        promoteSound.play().catch(() => {});
      }
      if (board) {
        board.classList.remove("flash-green", "flash-orange");
        void board.offsetWidth;
        if (base === "R") {
            board.classList.add("flash-green");
            setTimeout(() => board.classList.remove("flash-green"), 2000);
        } else if (base === "B") {
            board.classList.add("flash-orange");
            setTimeout(() => board.classList.remove("flash-orange"), 2000);
        }
      }
    } else {
      if (!piece.includes("+") && canPromote(base) && 
         (isInPromotionZone(sel.y, player) || isInPromotionZone(y, player))) {
         sel.unpromoted = true;
      }
    }

    boardState[sel.y][sel.x] = "";
    boardState[y][x] = piece;
    pieceStyles[y][x] = pieceStyles[sel.y][sel.x];
    pieceStyles[sel.y][sel.x] = null;
  }

  // 棋譜記録
  const currentMoveStr = formatMove(sel, x, y, pieceBefore, boardBefore, moveNumber);
  const currentMoveContent = currentMoveStr.split("：")[1] || currentMoveStr;
  kifu.push(""); 
  
  if (typeof lastSkillKifu !== 'undefined' && lastSkillKifu !== "") {
      kifu[kifu.length - 1] = `${moveNumber}手目：${lastSkillKifu}★，${currentMoveContent}`;
      lastSkillKifu = ""; 
  } else {
      kifu[kifu.length - 1] = currentMoveStr;
  }

  lastMoveTo = { x, y };

  if (turn !== "") { 
    lastPlayerMove = {
      piece: pieceBefore.replace("+","").toUpperCase(),
      toX: x, toY: y
    };
  }

  // ▼▼▼ 【変更】手番交代の制御（2回行動用） ▼▼▼
  if (isCpuDoubleAction) {
      // 必殺技発動中なら、手番を交代せず、相手をパスさせる
      isCpuDoubleAction = false; // フラグ回収

      // 棋譜にパスを記録
      // 次の相手（プレイヤー）
      const playerRole = (turn === "black") ? "white" : "black";
      const mark = (playerRole === "black") ? "▲" : "△";
      kifu.push(`${kifu.length + 1}手目：${mark}パス(硬直)★`);
      moveCount++; // パスも1手

      statusDiv.textContent = "必殺技の効果！ プレイヤーは行動できません！";
      
      // turn（手番）を入れ替えない！ = ずっとCPUのターン

      // 画面更新
      selected = null;
      legalMoves = [];
      render(); 
      if (typeof showKifu === "function") showKifu();

      // ★2回目の思考を開始
      if (!gameOver) {
          // 少し待ってから次の手を考えさせる
          setTimeout(() => {
             // 元々のCPU思考開始ロジック（executeMoveの最後にあるやつ）と同じことをする
             // ただし、もし cpuMove がないなら、AI呼び出し処理をここに書く必要があるかもしれません。
             // 通常は executeMove の最後にある setTimeout(() => cpuMove(), 1000); が走ればOKですが、
             // turn が変わっていないので、下の判定ブロックに入ってくれるはずです。
          }, 100);
      }

  } else {
      // --- 通常の手番交代 ---
      turn = turn === "black" ? "white" : "black";
      window.isCaptureRestricted = false;
      
      selected = null;
      legalMoves = [];

      render(); 
      if (typeof showKifu === "function") showKifu();

      if (!gameOver) startTimer();
      else stopTimer();
      moveCount++;
  }
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  // ポイント加算（既存コード）
  if (!gameOver) {
      let gain = 0;
      // ...（省略：SP_CONFIGを使った加算ロジックはそのまま）...
      const getPoint = (configCategory, pieceCode) => {
          const raw = pieceCode.toUpperCase();
          const base = raw.replace("+", "");
          if (configCategory[raw] !== undefined) return configCategory[raw];
          if (configCategory[base] !== undefined) return configCategory[base];
          return 10;
      };
      if (sel.fromHand) {
          const piece = boardState[y][x]; 
          gain += getPoint(SP_CONFIG.DROP, piece);
      } else {
          const piece = boardState[y][x];
          gain += getPoint(SP_CONFIG.MOVE, piece);
      }
      if (sel.promoted) {
          const piece = boardState[y][x].replace("+","");
          gain += (SP_CONFIG.PROMOTE[piece.toUpperCase()] || 20);
      }
      const captured = boardBefore[y][x];
      if (captured !== "") {
          gain += getPoint(SP_CONFIG.CAPTURE, captured);
      }
      const isPlayerAction = (sel.player === "black" && cpuSide === "white") || (sel.player === "white" && cpuSide === "black");
      if (isPlayerAction) {
          addSkillPoint(gain);
      } else {
          addCpuSkillPoint(gain);
      }
  }

  checkGameOver();

  // ▼▼▼ CPU思考開始トリガー（ここも少し調整） ▼▼▼
  // cpuMove がない場合、AIスクリプト側が独自に動いている可能性がありますが、
  // もし main.js から呼び出しているならここを通ります。
  if (!isSimulating && cpuEnabled && turn === cpuSide && !gameOver) {
      // 2回行動直後の場合はウェイトを長めに、通常は1秒
      const delay = isCpuDoubleAction ? 1500 : 1000;
      
      // もし cpuMove が見つからない場合、ここでAIの思考関数を呼ぶ必要があります。
      // 既存のコードで `setTimeout(() => cpuMove(), 1000);` となっていた箇所です。
      // もし cpuMove が未定義エラーになる場合は、AIスクリプト内の関数名（例: aiThink()）に書き換えてください。
      if (typeof cpuMove === 'function') {
          setTimeout(() => cpuMove(), delay);
      } else if (typeof aiThink === 'function') {
          // ai_Lv1.js などを使っている場合
          setTimeout(() => aiThink(), delay);
      }
  }
}

// script/main.js

function onCellClick(x, y) {
  if (gameOver) return;

  // 必殺技ターゲット選択中
  if (typeof isSkillTargeting !== 'undefined' && isSkillTargeting) {
    // クリックした場所が有効なターゲット（legalMoves）に含まれているか確認
    if (legalMoves.some(m => m.x === x && m.y === y)) {

      // システム介入型（待った等）の分岐
      if (currentSkill.isSystemAction) {
        currentSkill.execute(x, y);
        
        isSkillTargeting = false;
        legalMoves = [];
        selected = null;
        
        const boardTable = document.getElementById("board");
        if (boardTable) boardTable.classList.remove("skill-targeting-mode");

        if (typeof undoMove === "function") {
             undoMove();
        }

        window.skillUsed = true;
        skillUseCount = 1; // コスト消費は別途行われるが、使用フラグは立てる
        
        updateSkillButton();
        render(); 
        statusDiv.textContent = "必殺技発動！ 時を戻しました。";
        return; 
      }

      // ★技を実行（1段階目かもしれないし、完了かもしれない）
      const result = currentSkill.execute(x, y);

      // ▼▼▼ 【重要修正】技がまだ続いている場合（SilverArmorの1段階目など） ▼▼▼
      if (result === null) {
          // ステップが進んだので、次の有効なターゲット（移動先）を取得しなおす
          const nextTargets = currentSkill.getValidTargets();
          
          if (nextTargets && nextTargets.length > 0) {
              // 有効な移動先がある場合、ターゲット情報を更新して待機
              legalMoves = nextTargets;
              
              // 盤面を再描画して、移動先（黄色）や選択中の駒（オレンジ）を表示
              render();
              statusDiv.textContent = `必殺技【${currentSkill.name}】：移動先を選んでください`;
          } else {
              // 万が一、移動先がない場合
              alert("有効な移動先がありません。");
              // リセットして終了
              if (currentSkill.reset) currentSkill.reset();
              isSkillTargeting = false;
              legalMoves = [];
              selected = null;
              render();
              statusDiv.textContent = "移動できませんでした。";
          }
          return; // ここで処理を終える（ポイント消費や手番交代はまだしない）
      }
      // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

      
      // --- 以下は「技が完全に完了した」場合の処理 ---

      // ★ ポイント消費（完了時のみ消費）
      if (typeof currentSkill.getCost === "function") {
          consumeSkillPoint(currentSkill.getCost());
      }

      history.push(deepCopyState());

      const boardTable = document.getElementById("board");
      if (boardTable) boardTable.classList.remove("skill-targeting-mode");

      const endsTurn = (currentSkill.endsTurn !== false);
      window.skillUsed = true; 
      skillUseCount++;

      if (endsTurn) {
          const kifuStr = result; 
          kifu.push(""); 
          kifu[kifu.length - 1] = kifuStr;
          moveCount++;
          turn = (turn === "black" ? "white" : "black");
      } else {
          const movePart = result.split("：")[1] || result;
          lastSkillKifu = movePart;
          statusDiv.textContent += " (必殺技完了！続けて指してください)";
      }
      
      lastMoveTo = null;
      if (moveSound) { moveSound.currentTime = 0; moveSound.play().catch(() => {}); }

      if (currentSkill.reset) currentSkill.reset();
      isSkillTargeting = false;
      legalMoves = [];
      selected = null;
      
      updateSkillButton();
      render();
      if (typeof showKifu === "function") showKifu();

      if (endsTurn && !isSimulating && cpuEnabled && turn === cpuSide && !gameOver) {
        setTimeout(() => cpuMove(), 1000);
      }
    }
    return;
  }

  // --- 通常の移動処理（変更なし） ---
  if (cpuEnabled && turn === cpuSide) return;

  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;
    const isWhite = piece === piece.toLowerCase();
    if ((turn === "black" && isWhite) || (turn === "white" && !isWhite)) return;
    
    // player情報を付与（ポイント計算用）
    selected = { x, y, fromHand: false, player: turn }; 
    legalMoves = getLegalMoves(x, y);
    
    if (window.isCaptureRestricted) {
        legalMoves = legalMoves.filter(m => boardState[m.y][m.x] === "");
    }

    render();
    return;
  }

  const sel = selected;
  if (legalMoves.some(m => m.x === x && m.y === y)) {
    movePieceWithSelected(sel, x, y);
  } else {
    selected = null;
    legalMoves = [];
    render();
  }
}

function selectFromHand(player, index) {
  if (gameOver) return;
  if (turn !== player) return;
  selected = { fromHand: true, player, index };
  legalMoves = getLegalDrops(player, hands[player][index]);
  render();
}

function movePieceWithSelected(sel, x, y) {
  if (sel.fromHand) {
    executeMove(sel, x, y, false);
    return;
  }

  const piece = boardState[sel.y][sel.x];
  const isWhite = piece === piece.toLowerCase();
  const player = isWhite ? "white" : "black";
  const isPromoted = piece.includes("+");
  const base = piece.replace("+","").toUpperCase();

  if (!isPromoted && canPromote(base) && 
      (isInPromotionZone(sel.y, player) || isInPromotionZone(y, player))) {
    
    if (cpuEnabled && turn === cpuSide) {
      executeMove(sel, x, y, true);
    } else {
      const mustPromote =
        (base === "P" || base === "L") && (y === (player === "black" ? 0 : 8)) ||
        (base === "N") && (y === (player === "black" ? 0 : 8) || y === (player === "black" ? 1 : 7));
      
      if (mustPromote) {
        executeMove(sel, x, y, true);
      } else {
        pendingMove = { sel, x, y }; 
        const modal = document.getElementById("promoteModal");
        if (modal) {
            modal.style.display = "flex";
        } else {
            if(confirm("成りますか？")) executeMove(sel, x, y, true);
            else executeMove(sel, x, y, false);
        }
      }
    }
  } else {
    executeMove(sel, x, y, false);
  }
}

// --- その他 ユーティリティ ---
function checkGameOver() {
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    saveGameResult(null);
    render();
    return;
  }
  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";
    saveGameResult(winner);
    render();
    return;
  }
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();
  if (positionHistory[key] >= 4) {
    gameOver = true;
    winner = null;
    statusDiv.textContent = "千日手です。引き分け。";
    render();
  }
}

function playBGM() {
  if (!bgm) return;
  bgm.volume = 0.3;
  bgm.play().catch(() => {
    document.addEventListener("click", () => {
      bgm.play().catch(e => console.log(e));
    }, { once: true });
  });
}

function stopBGM() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

function applyPlayerImage() {
  const isWhiteMode = document.body.classList.contains("view-white");
  // 後手モードなら whiteHandBox、そうでなければ blackHandBox が「自分の台」
  const myBoxId = isWhiteMode ? "whiteHandBox" : "blackHandBox";
  const myBox = document.getElementById(myBoxId);
  
  if (!myBox) return;
  
  const charId = sessionStorage.getItem('char_black') || 'default';
  let imageUrl = "";
  if (charId === 'default') imageUrl = "url('script/image/karui_1p.PNG')";
  else if (charId === 'char_a') imageUrl = "url('script/image/char_a.png')";
  else if (charId === 'char_b') imageUrl = "url('script/image/char_b.png')";
  else if (charId === 'char_d') imageUrl = "url('script/image/char_d.png')";
  
  if (imageUrl) myBox.style.backgroundImage = imageUrl;
}

function undoMove() {
  if (typeof isThinking !== 'undefined' && isThinking) return;
  if (typeof isSkillTargeting !== 'undefined' && isSkillTargeting) {
    isSkillTargeting = false;
    legalMoves = [];
    render();
    return;
  }
  if (history.length < 2 || gameOver) return;
  const prev = history[history.length - 2];
  history.length -= 2; 
  restoreState(prev);
  lastMoveFrom = null;
  window.isCaptureRestricted = false;
  gameOver = false;
  winner = null;
  statusDiv.textContent = "";
  checkStatusDiv.textContent = "";
  render();
  if (typeof showKifu === "function") showKifu();
  startTimer();
}

function resignGame() {
  if (gameOver) return;
  const modal = document.getElementById("resignModal");
  if (modal) modal.style.display = "flex";
  else if (confirm("投了しますか？")) executeResign();
}

function executeResign() {
  closeResignModal();
  gameOver = true;
  stopTimer();
  winner = "white"; 
  if (typeof saveGameResult === "function") saveGameResult(winner);
  render();
  if (typeof showKifu === "function") showKifu();
}

function closeResignModal() {
  const modal = document.getElementById("resignModal");
  if (modal) modal.style.display = "none";
}

function toggleSkillMode() {
  if (gameOver) return;
  if (!currentSkill) return;
  if (isSkillTargeting) return;

  // ★★★ 修正箇所：単純なフラグではなく、回数上限に達しているかで判定する ★★★
  const max = currentSkill.maxUses || 1;
  
  if (skillUseCount >= max) {
    alert("この対局では、必殺技はもう使えません。");
    return;
  }
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

  if (!currentSkill.canUse()) {
    alert("現在は必殺技の発動条件を満たしていません。");
    return;
  }
  const modal = document.getElementById("skillModal");
  if (modal) modal.style.display = "flex";
}

function confirmSkillActivate() {
  closeSkillModal();
  if (currentSkill.reset) currentSkill.reset();
  selected = null;
  const targets = currentSkill.getValidTargets();
  if (!targets || targets.length === 0) {
      alert("この必殺技で動かせる有効な場所がありません。");
      isSkillTargeting = false;
      return; 
  }
  isSkillTargeting = true;
  legalMoves = targets;
  const boardTable = document.getElementById("board");
  if (boardTable) boardTable.classList.add("skill-targeting-mode");
  render();
  statusDiv.textContent = `必殺技【${currentSkill.name}】：発動するマスを選んでください`;
}

function closeSkillModal() {
  const modal = document.getElementById("skillModal");
  if (modal) modal.style.display = "none";
}


function updateSkillButton() {
    const skillBtn = document.getElementById("skillBtn");
    if (!skillBtn) return;

    // ★★★ 追加：ふぉーまるモードの場合 ★★★
    if (isFormalMode) {
        skillBtn.style.display = "inline-block"; // レイアウト維持
        skillBtn.textContent = "---";           // 無効化テキスト
        skillBtn.disabled = true;                // クリック不可
        skillBtn.style.backgroundColor = "#555"; // グレー背景
        skillBtn.style.color = "#888";           // 薄い文字
        skillBtn.style.border = "2px solid #333";
        skillBtn.style.cursor = "default";       // カーソル戻し
        skillBtn.style.opacity = "0.5";          // 半透明
        return; // 処理終了
    }
    // ★★★ ここまで ★★★

  if (currentSkill) {
    skillBtn.style.display = "inline-block";
    skillBtn.textContent = currentSkill.name;

    if (currentSkill.buttonStyle) {
      Object.assign(skillBtn.style, currentSkill.buttonStyle);
    }

    // ★★★ 変更箇所：コスト判定 ★★★
    let cost = 0;
    if (typeof currentSkill.getCost === "function") {
        cost = currentSkill.getCost();
    }
    
    // ポイントが足りているか？
    const canAfford = (playerSkillPoint >= cost);
    // 発動条件を満たしているか？（盤面条件など）
    const conditionMet = currentSkill.canUse();

    // 両方OKなら押せる
    if (canAfford && conditionMet) {
       skillBtn.disabled = false;
       skillBtn.style.opacity = 1.0;
       skillBtn.style.filter = "none";
    } else {
       skillBtn.disabled = true;
       skillBtn.style.opacity = 0.6;
       // お金が足りない時は白黒にするなど
       if (!canAfford) skillBtn.style.filter = "grayscale(100%)";
    }
  } else {
    skillBtn.style.display = "none";
  }
}

function resolvePromotion(doPromote) {
  const modal = document.getElementById("promoteModal");
  if (modal) modal.style.display = "none";
  if (pendingMove) {
    executeMove(pendingMove.sel, pendingMove.x, pendingMove.y, doPromote);
    pendingMove = null;
  }
}

function toggleKifu() {
    const area = document.getElementById("kifuArea");
    if (area.style.display === "none") {
        area.style.display = "flex"; // flexに変更して中央揃えを有効にする
        
        // 最新の棋譜が一番下に来るように自動スクロール
        const scrollBox = document.getElementById("kifu");
        if (scrollBox) {
            // 少しだけ待機してからスクロールさせるのがコツ
            setTimeout(() => {
                scrollBox.scrollTop = scrollBox.scrollHeight;
            }, 50);
        }
    } else {
        area.style.display = "none";
    }
}

function copyKifuText() {
  const kifuDiv = document.getElementById("kifu");
  if (kifuDiv) {
      navigator.clipboard.writeText(kifuDiv.innerText).then(() => {
          alert("棋譜をコピーしました！");
      });
  }
}

function playSkillEffect(imageName, soundName, flashColor) {
  const img = document.getElementById("skillCutIn");
  if (img && imageName) {
    img.src = "script/image/" + imageName;
    img.classList.remove("cut-in-active");
    void img.offsetWidth;
    img.classList.add("cut-in-active");
  }
  if (soundName) {
    if (Array.isArray(soundName)) {
      soundName.forEach(name => {
        const a = new Audio("script/audio/" + name);
        a.play().catch(e => {});
      });
    } else {
      const audio = document.getElementById("skillSound") || new Audio("script/audio/" + soundName);
      audio.src = "script/audio/" + soundName;
      audio.play().catch(e => {});
    }
  }
  if (board && flashColor) {
    board.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red", "flash-blue");
    void board.offsetWidth; 
    board.classList.add("flash-" + flashColor);
  }
}

let timerInterval = null;
let currentSeconds = 0;

function startTimer() {
  stopTimer();
  currentSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    currentSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const timerBox = document.getElementById("timerBox");
  if (timerBox) timerBox.textContent = "考慮時間: " + currentSeconds + "秒";
}

// script/main.js の saveGameResult 関数をこれに置き換えてください

function saveGameResult(res) {
  const user = auth.currentUser;
  if (!user) return; // ログインしていない場合は保存しない

  const opponentDisplayName = window.opponentName || "CPU対局";
  
  // プレイヤーの色を判定（cpuSideがwhiteなら、プレイヤーはblack）
  const playerColor = (cpuSide === "white" ? "black" : "white");
  
  // 勝敗判定
  const isWin = (res === playerColor);

  // ★★★ 追加：獲得ゴールドの計算 ★★★
  // オフラインは少し控えめに設定（勝:50G / 負:10G）
  let earnedGold = 0;
  if (isWin) {
      earnedGold = 30; 
  } else {
      earnedGold = 5;
  }

  const gameRecord = {
      date: new Date(), 
      opponent: opponentDisplayName,
      moves: moveCount,
      result: isWin ? "WIN" : "LOSE",
      mode: "offline",
      kifuData: kifu 
  };

  if (typeof updateMissionProgress === "function") {
      // 1. 「対局する」ミッションの進行 (+1回)
      updateMissionProgress("play", 1);

      // 2. 「勝利する」ミッションの進行 (勝った場合のみ +1回)
      if (isWin) {
          updateMissionProgress("win", 1);
      }
  }
  // Firestore更新
  db.collection("users").doc(user.uid).update({
      win: firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
      lose: firebase.firestore.FieldValue.increment(isWin ? 0 : 1),
      history: firebase.firestore.FieldValue.arrayUnion(gameRecord),
      // ★ここにゴールド加算を追加
      gold: firebase.firestore.FieldValue.increment(earnedGold)
  }).then(() => {
      console.log(`${opponentDisplayName}戦記録完了: +${earnedGold}G`);
      
      // ★★★ 追加：画面に獲得金額を表示する演出 ★★★
      if (statusDiv) {
          const msg = isWin ? "勝利ボーナス" : "参加報酬";
          const color = isWin ? "#ffd700" : "#cccccc"; // 金色 / 灰色
          
          const rewardMsg = document.createElement("div");
          rewardMsg.style.fontWeight = "bold";
          rewardMsg.style.color = "#d32f2f";
          rewardMsg.style.marginTop = "5px";
          // 💰アイコン付きで表示
          rewardMsg.innerHTML = `<span style="background:${color}; padding:2px 5px; border-radius:3px;">${msg}</span> 💰${earnedGold}G GET!`;
          
          statusDiv.appendChild(rewardMsg);
      }
  }).catch(console.error);
}

// script/main.js の末尾に追加

// ★★★ 駒台の左右を入れ替える関数 ★★★

function updateHandLayout(playerRole) {
    const leftSide = document.querySelector(".side.left");
    const rightSide = document.querySelector(".side.right");
    const blackBox = document.getElementById("blackHandBox");
    const whiteBox = document.getElementById("whiteHandBox");

    if (!leftSide || !rightSide || !blackBox || !whiteBox) return;

    if (playerRole === "white") {
        // --- プレイヤーが後手の場合 ---
        
        // クラスを入れ替えて背景画像を交代させる
        blackBox.classList.remove("black-hand");
        blackBox.classList.add("white-hand"); // CPU(先手)だけど画像は2P用にする

        whiteBox.classList.remove("white-hand");
        whiteBox.classList.add("black-hand"); // 自分(後手)だけど画像は1P用にする

        // 配置の入れ替え
        leftSide.prepend(blackBox);
        rightSide.appendChild(whiteBox);
    } else {
        // --- プレイヤーが先手の場合（通常） ---
        
        blackBox.classList.remove("white-hand");
        blackBox.classList.add("black-hand");

        whiteBox.classList.remove("black-hand");
        whiteBox.classList.add("white-hand");

        // 配置の入れ替え
        leftSide.prepend(whiteBox);
        rightSide.appendChild(blackBox);
    }
}


function toggleMenu() {
    const panel = document.getElementById('menuPanel');
    panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
}

// --- 音量設定の制御 ---
function toggleVolume() {
    const modal = document.getElementById("volumeModal");
    if (modal) modal.style.display = "flex";
}

function updateVolume() {
    const bgm = document.getElementById("bgm");
    const range = document.getElementById("bgmRange");
    if (bgm && range) {
        bgm.volume = range.value;
        // ミュート状態も解除しておく
        bgm.muted = false;
    }
}

function closeVolumeModal() {
    document.getElementById("volumeModal").style.display = "none";
}

// --- ルール確認の制御 ---
function showRules() {
    const modal = document.getElementById("rulesModal");
    if (modal) modal.style.display = "flex";
}

function closeRulesModal() {
    document.getElementById("rulesModal").style.display = "none";
}

// 画面外をクリックしたらメニューを閉じる処理（お好みで）
window.onclick = function(event) {
    if (!event.target.matches('#menuTrigger')) {
        const panel = document.getElementById('menuPanel');
        if (panel && panel.style.display === 'block') {
            panel.style.display = 'none';
        }
    }
}

// ★★★ 着せ替え反映用関数 ★★★
function applyUserSkin() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    db.collection("users").doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const equipped = data.equipped || {};
            
            if (typeof GAME_ITEMS !== 'undefined') {
                // --- 駒の反映 ---
                if (equipped.piece) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.piece);
                    if (item && item.image) {
                        document.documentElement.style.setProperty('--piece-img', `url('${item.image}')`);
                    }
                }
                // --- 盤の反映 ---
                if (equipped.board) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.board);
                    if (item && item.image) {
                        document.documentElement.style.setProperty('--board-img', `url('${item.image}')`);
                    }
                }
                
                // --- ★★★ 追加：BGMの反映 ★★★ ---
                if (equipped.bgm) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.bgm);
                    // アイテムが存在し、かつ src プロパティがある場合
                    if (item && item.src) {
                        const bgmEl = document.getElementById("bgm");
                        if (bgmEl) {
                            // 現在再生中のソースと違う場合のみ変更（リロード防止）
                            // ※パスの比較は完全一致しないことがあるので、ファイル名が含まれるかで判定するなど工夫してもOK
                            // ここでは単純に上書きします
                            bgmEl.src = item.src;
                            
                            // 画面ロード時に自動再生させたい場合はここでも play() を呼ぶことができますが、
                            // 通常は「対局開始」等のタイミングで playBGM() が呼ばれるので、srcを変えるだけでOKです。
                        }
                    }
                }
            }
        }
    }).catch(console.error);
}

// script/main.js の末尾に追加

function addSkillPoint(amount) {
    // ★追加：ふぉーまるモードならポイントを加算しない
    if (isFormalMode) return;

    playerSkillPoint += amount;
    if (playerSkillPoint > MAX_SKILL_POINT) playerSkillPoint = MAX_SKILL_POINT;
    updateSkillGaugeUI();
    updateSkillButton(); 
}

function consumeSkillPoint(amount) {
    playerSkillPoint -= amount;
    if (playerSkillPoint < 0) playerSkillPoint = 0;
    updateSkillGaugeUI();
    updateSkillButton();
}

function updateSkillGaugeUI() {
    const bar = document.getElementById("skillGaugeBar");
    const text = document.getElementById("skillGaugeText");
    const costText = document.getElementById("nextCostText");

    if (bar && text) {
        // ゲージの長さ（最大値を基準に％計算。ここでは仮に300をMAX表示幅とするか、上限1000にするか）
        // 視覚的にわかりやすくするため、一旦「次のコスト」に対してどれくらい溜まったか？を表示する手もありますが、
        // ここでは単純に上限1000に対する割合で表示します。
        const percentage = (playerSkillPoint / MAX_SKILL_POINT) * 100;
        bar.style.height = percentage + "%"; 
        text.textContent = Math.floor(playerSkillPoint);
    }
    
    if (costText && currentSkill && typeof currentSkill.getCost === "function") {
        const cost = currentSkill.getCost();
        costText.textContent = `Next: ${cost}pt`;
        
        // ポイントが足りていればコスト表示を黄色、足りなければ赤にするなど
        costText.style.color = (playerSkillPoint >= cost) ? "#ffd700" : "#ff4500";
    }
}

// main.js の末尾に追加

function addCpuSkillPoint(amount) {
    // ★追加：CPUもポイントを加算しない
    if (isFormalMode) return;

    cpuSkillPoint += amount;
    if (cpuSkillPoint > MAX_SKILL_POINT) cpuSkillPoint = MAX_SKILL_POINT;
    updateCpuSkillGaugeUI();
    
    // ※将来的に、ここで「CPUが必殺技を使うか？」の判定を入れることができます
}

function updateCpuSkillGaugeUI() {
    const bar = document.getElementById("cpuSkillGaugeBar");
    const text = document.getElementById("cpuSkillGaugeText");

    if (bar && text) {
        const percentage = (cpuSkillPoint / MAX_SKILL_POINT) * 100;
        bar.style.height = percentage + "%";
        text.textContent = Math.floor(cpuSkillPoint);
        
        if (cpuSkillPoint >= MAX_SKILL_POINT) {
             bar.classList.add("gauge-max"); // 光らせる場合
        } else {
             bar.classList.remove("gauge-max");
        }
    }
}

function consumeCpuSkillPoint(amount) {
    cpuSkillPoint -= amount;
    if (cpuSkillPoint < 0) cpuSkillPoint = 0;
    updateCpuSkillGaugeUI();
}

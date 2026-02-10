// script/yaneuraou_main.js
// やねうら王専用メインスクリプト（必殺技ゲージ・CPU神速・グラフ機能完全統合版）

// --- ★やねうら王用 設定変数 ---
let usiHistory = []; // 棋譜（USI形式）を記録する配列
let isEngineReady = false; // エンジンの準備ができているか
let evalHistory = [0]; // 評価値の履歴（初期値0）
let evalChart = null;  // グラフのインスタンス
let isPondering = false; // 先読み中かどうか
let ponderTimer = null;  // 休憩用のタイマー
let isStoppingPonder = false;// Ponder停止中かどうかのフラグ
let hasShownEndEffect = false;

// --- ★必殺技・ゲージ関連の設定変数 ---
window.skillUsed = false;
window.isCaptureRestricted = false;
let lastSkillKifu = ""; 
let pendingMove = null;

// ★CPU 2回行動用
let isCpuDoubleAction = false;
let cpuSkillUseCount = 0;

// ★ゲージ用ポイント
let playerSkillPoint = 0;
let cpuSkillPoint = 0;
const MAX_SKILL_POINT = 1000;

// ★ポイント設定（SP_CONFIG）
const SP_CONFIG = {
  MOVE: { "P": 5, "+P": 15, "L": 8, "+L": 15, "N": 8, "+N": 15, "S": 10, "+S": 15, "G": 10, "B": 15, "+B": 30, "R": 15, "+R": 30, "K": 20 },
  DROP: { "P": 10, "L": 12, "N": 12, "S": 15, "G": 15, "B": 20, "R": 20 },
  CAPTURE: { "P": 10, "+P": 30, "L": 20, "+L": 40, "N": 20, "+N": 40, "S": 30, "+S": 50, "G": 40, "B": 60, "+B": 100, "R": 60, "+R": 100, "K": 1000 },
  PROMOTE: { "P": 20, "L": 25, "N": 25, "S": 30, "B": 50, "R": 50 }
};

// DOM要素の参照
const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");


// --- 初期化処理 ---
window.addEventListener("load", () => {
  // グローバル変数のリセット（globals.jsで定義されているskillUseCountなど）
  if (typeof skillUseCount !== 'undefined') skillUseCount = 0;

  bgm = document.getElementById("bgm");
  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  if (resignBtn) {
    resignBtn.addEventListener("click", resignGame);
  }

  // ★★★ 1. 先手・後手のランダム決定 ★★★
  const isPlayerBlack = Math.random() < 0.5;

  if (isPlayerBlack) {
      // プレイヤーが先手
      cpuSide = "white"; // AIは後手
      document.body.classList.remove("view-white");
      updateHandLayout("black"); // 駒台配置：標準
  } else {
      // プレイヤーが後手
      cpuSide = "black"; // AIは先手
      document.body.classList.add("view-white"); // 盤面反転
      updateHandLayout("white"); // 駒台配置：反転
  }

  // 画像反映
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
  
  render();
  if (typeof showKifu === "function") showKifu();

  const key = getPositionKey();
  positionHistory[key] = 1;
  
  // グラフ初期化
  initChart();

  // エンジン起動
  if (typeof initEngine === 'function') {
      console.log("ロードちゅう…");
      statusDiv.textContent = "ロードちゅう…";
      initEngine(); 
      
      setTimeout(() => {
          if(!isEngineReady) {
            sendToEngine("usi");
          }
      }, 1000);
  } else {
      console.error("engine_bridge.js が読み込まれていません！");
      statusDiv.textContent = "エラー: エンジンが見つかりません";
  }
  
  firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            applyUserSkin();
        }
    });
});

function sendToEngine(msg) {
    if (typeof engineWorker !== 'undefined' && engineWorker) {
        engineWorker.postMessage(msg);
    } else {
        console.error("Workerが見つかりません:", msg);
    }
}

function handleEngineMessage(msg) {
    // 評価値解析
    if (typeof msg === "string" && msg.includes("info") && msg.includes("score cp")) {
        const parts = msg.split(" ");
        const scoreIdx = parts.indexOf("cp") + 1;
        let score = parseInt(parts[scoreIdx]);

        if (turn === "white") {
            score = -score;
        }
        
        evalHistory[moveCount] = score;
        for(let i = 0; i < moveCount; i++) {
            if (evalHistory[i] === undefined) evalHistory[i] = evalHistory[i-1] || 0;
        }
        updateChart();
    }

    if (msg === "usiok") {
        console.log("USI OK! -> isready");
        sendToEngine("isready");
    }
    else if (msg === "readyok") {
        isEngineReady = true;
        
        if (cpuSide === "white") {
             statusDiv.textContent = "対局開始！ あなたは【先手】です。";
        } else {
             statusDiv.textContent = "対局開始！ あなたは【後手】です。";
        }
        console.log("Ready OK!");

        // AIが先手の場合、思考開始
        if (turn === cpuSide) {
             setTimeout(() => cpuMove(), 1000);
        }
    }
    else if (typeof msg === "string" && msg.startsWith("bestmove")) {
        const parts = msg.split(" ");
        const bestMove = parts[1];
        
        if (isStoppingPonder) {
             console.log("Ponder停止によるbestmoveを無視");
             isStoppingPonder = false;
             return;
        }

        // 自分の手番でないなら無視
        if (turn !== cpuSide) {
             return;
        }
        
        if (bestMove === "resign") {
            resignGame(); 
        } else if (bestMove === "win") {
            statusDiv.textContent = "エンジンの勝ち宣言";
            gameOver = true;
        } else {
            applyUsiMove(bestMove);
            
            // ★重要：2回行動の途中（手番がまだCPU）ならPonderせず、次の思考へ
            // そうでない（手番がプレイヤーに移った）ならPonderする
            if (!gameOver && turn !== cpuSide) {
                setTimeout(startPondering, 500); 
            }
        }
    }
}

// AI思考ロジック
function cpuMove() {
    if (gameOver) return;
    if (!isEngineReady) {
        statusDiv.textContent = "エンジン起動待ち...";
        setTimeout(cpuMove, 1000);
        return;
    }

    statusDiv.textContent = "考え中...";

    let positionCmd = "";
    // 必殺技後・2回行動中・履歴なしの場合はSFEN
    if ((typeof skillUsed !== 'undefined' && skillUsed) || usiHistory.length === 0 || isCpuDoubleAction) {
        const sfen = generateSfen();
        positionCmd = "position sfen " + sfen;
    } 
    else {
        positionCmd = "position startpos moves " + usiHistory.join(" ");
    }

    sendToEngine(positionCmd);

    let thinkTime = (moveCount > 20) ? 10000 : 3000;
    console.log(`手数: ${moveCount}, 思考時間: ${thinkTime}ms`);
    sendToEngine("go byoyomi " + thinkTime);
}

// AIの指し手反映
function applyUsiMove(usiMove) {
    if (usiMove === "resign") return;

    let sel = null;
    let toX = -1;
    let toY = -1;
    let doPromote = false;

    if (usiMove.includes("*")) {
        const pieceChar = usiMove[0];
        const fileTo = parseInt(usiMove[2]);
        const rankToChar = usiMove[3];
        toX = 9 - fileTo;
        toY = rankToChar.charCodeAt(0) - 97;
        const handIndex = hands[turn].findIndex(p => p === pieceChar);
        if (handIndex === -1) return;
        
        // ★修正：player情報を付与（ポイント計算用）
        sel = { fromHand: true, player: turn, index: handIndex };
        
        doPromote = false;
    } else {
        const fileFrom = parseInt(usiMove[0]);
        const rankFromChar = usiMove[1];
        const fileTo = parseInt(usiMove[2]);
        const rankToChar = usiMove[3];
        const isPromote = usiMove.includes("+");
        const fromX = 9 - fileFrom;
        const fromY = rankFromChar.charCodeAt(0) - 97;
        toX = 9 - fileTo;
        toY = rankToChar.charCodeAt(0) - 97;
        
        // ★修正：player情報を付与（ポイント計算用）
        sel = { x: fromX, y: fromY, fromHand: false, player: turn };
        
        doPromote = isPromote;
    }
    // AIはexecuteMoveを直接呼ぶ
    // ※ここで executeMove 冒頭の「割り込み」が発動する可能性がある
    executeMove(sel, toX, toY, doPromote);
}

// 実際の移動処理（メインロジック）
function executeMove(sel, x, y, doPromote) {
  if (typeof stopPondering === "function") stopPondering();

  // ▼▼▼ 【追加】CPUの必殺技発動チェック（指す直前） ▼▼▼
  if (!gameOver && turn === cpuSide && !isCpuDoubleAction && typeof CpuDoubleAction !== 'undefined') {
      const cost = CpuDoubleAction.getCost();
      if (cpuSkillPoint >= cost) {
          consumeCpuSkillPoint(cost);
          isCpuDoubleAction = true;
          cpuSkillUseCount++;

          playSkillEffect(null, "skill.mp3", "red");
          statusDiv.textContent = `CPUが必殺技【${CpuDoubleAction.name}】を発動！`;

          setTimeout(() => {
              executeMove(sel, x, y, doPromote); 
          }, 1500);
          return; 
      }
  }
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  // 移動元の記録
  if (sel.fromHand) {
      lastMoveFrom = null;
  } else {
      lastMoveFrom = { x: sel.x, y: sel.y };
  }

  const pieceBefore = sel.fromHand
    ? hands[sel.player][sel.index]
    : boardState[sel.y][sel.x];

  history.push(deepCopyState());
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
    if (target) hands[turn].push(target.replace("+","").toUpperCase());

    const isWhite = piece === piece.toLowerCase();
    const player = isWhite ? "white" : "black";
    const base = piece.replace("+","").toUpperCase();

    if (doPromote) {
      piece = promote(piece.toUpperCase());
      if (player === "white") piece = piece.toLowerCase();
      sel.promoted = true;
      if (promoteSound) {
        promoteSound.currentTime = 0;
        promoteSound.volume = 0.8;
        promoteSound.play().catch(() => {});
      }
      const boardTable = document.getElementById("board");
      if (boardTable) {
        boardTable.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red", "flash-blue", "flash-yellow");
        void boardTable.offsetWidth;
        if (base === "R") {
            boardTable.classList.add("flash-green");
            setTimeout(() => boardTable.classList.remove("flash-green"), 2000);
        } else if (base === "B") {
            boardTable.classList.add("flash-orange");
            setTimeout(() => boardTable.classList.remove("flash-orange"), 2000);
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

  // ★USI履歴への記録
  const usiMove = convertToUsi(sel, x, y, doPromote, pieceBefore);
  // 必殺技使用済みフラグが立っている場合は履歴に追加しない
  if (!window.skillUsed) {
      usiHistory.push(usiMove);
  }

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
  if (!isSimulating && turn !== cpuSide) {
    lastPlayerMove = {
      piece: pieceBefore.replace("+","").toUpperCase(),
      toX: x, toY: y
    };
  }

  // ▼▼▼ 【変更】手番交代の制御（2回行動用） ▼▼▼
  if (isCpuDoubleAction) {
      isCpuDoubleAction = false; 

      const playerRole = (turn === "black") ? "white" : "black";
      const mark = (playerRole === "black") ? "▲" : "△";
      kifu.push(`${kifu.length + 1}手目：${mark}パス(硬直)★`);
      moveCount++; 

      statusDiv.textContent = "必殺技の効果！ プレイヤーは行動できません！";
      
      selected = null;
      legalMoves = [];
      render(); 
      if (typeof showKifu === "function") showKifu();

      // ★2回目の思考を開始
      if (!gameOver) {
          setTimeout(() => { cpuMove(); }, 100);
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
      
      // ★CPU思考開始（1秒後）
      if (turn === cpuSide && !gameOver) {
          setTimeout(() => cpuMove(), 1000);
      }
  }
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  // ★★★ ポイント加算 (main.jsと同じロジック) ★★★
  if (!gameOver) {
      let gain = 0;
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
}

function onCellClick(x, y) {
  if (gameOver) return;

  // --- 必殺技発動モード ---
  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      
      // システム介入型（待った等）
      if (currentSkill.isSystemAction) {
        if (typeof stopPondering === "function") stopPondering();
        currentSkill.execute(x, y);
        isSkillTargeting = false;
        legalMoves = [];
        selected = null;
        const boardTable = document.getElementById("board");
        if (boardTable) boardTable.classList.remove("skill-targeting-mode");
        if (typeof undoMove === "function") undoMove();
        
        if (typeof skillUseCount !== 'undefined') skillUseCount++; 
        updateSkillButton();
        render();
        statusDiv.textContent = "必殺技発動！ 時を戻しました。";
        return; 
      }

      // 通常必殺技
      if (typeof stopPondering === "function") stopPondering();
      const result = currentSkill.execute(x, y);

      // ★2段階スキルの対応
      if (result === null) {
          const nextTargets = currentSkill.getValidTargets();
          if (nextTargets && nextTargets.length > 0) {
              legalMoves = nextTargets;
              render();
              statusDiv.textContent = `必殺技【${currentSkill.name}】：移動先を選んでください`;
          } else {
              alert("有効な移動先がありません。");
              if (currentSkill.reset) currentSkill.reset();
              isSkillTargeting = false;
              legalMoves = [];
              selected = null;
              render();
          }
          return; 
      }

      // ★消費
      if (typeof currentSkill.getCost === "function") {
          consumeSkillPoint(currentSkill.getCost());
      }

      history.push(deepCopyState());
      const boardTable = document.getElementById("board");
      if (boardTable) boardTable.classList.remove("skill-targeting-mode");

      const endsTurn = (currentSkill.endsTurn !== false);
      window.skillUsed = true; 
      if (typeof skillUseCount !== 'undefined') skillUseCount++;
      usiHistory = []; // USIリセット

      if (endsTurn) {
          const kifuStr = result; 
          kifu.push(""); 
          kifu[kifu.length - 1] = kifuStr; 
          moveCount++;
          turn = (turn === "black" ? "white" : "black");
      } else {
          const movePart = result.split("：")[1] || result;
          lastSkillKifu = movePart;
      }
      
      lastMoveTo = null;
      if (moveSound) {
        moveSound.currentTime = 0;
        moveSound.play().catch(() => {});
      }

      // SFEN送信
      const sfen = generateSfen();
      console.log("必殺技発動！SFEN送信:", sfen);
      sendToEngine("position sfen " + sfen);

      if(currentSkill.reset) currentSkill.reset();
      isSkillTargeting = false;
      legalMoves = [];

      updateSkillButton();
      render();
      if (typeof showKifu === "function") showKifu();

      if (endsTurn && cpuEnabled && turn === cpuSide && !gameOver) {
        setTimeout(() => cpuMove(), 1000);
      }
    }
    return;
  }

  // --- 通常の手番処理 ---
  if (cpuEnabled && turn === cpuSide) return;

  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;
    const isWhite = piece === piece.toLowerCase();
    if ((turn === "black" && isWhite) || (turn === "white" && !isWhite)) return;
    
    // ★修正：player情報を付与
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
  } else {
    executeMove(sel, x, y, false);
  }
}

// 必殺技ボタン (コストチェックに修正)
function toggleSkillMode() {
  if (gameOver) return;
  if (typeof cpuSide !== 'undefined' && turn === cpuSide) return;
  if (!currentSkill) return;
  if (isSkillTargeting) return;

  const cost = (typeof currentSkill.getCost === "function") ? currentSkill.getCost() : 0;
  if (playerSkillPoint < cost) {
      alert(`ポイントが足りません (必要: ${cost}, 所持: ${Math.floor(playerSkillPoint)})`);
      return;
  }

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
      alert("この必殺技で動かせる有効な場所がありません。\n（王手放置になる、または動かせる駒がないなど）");
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
  
  if (currentSkill) {
    skillBtn.style.display = "inline-block";
    skillBtn.textContent = currentSkill.name;
    
    if (currentSkill.buttonStyle) Object.assign(skillBtn.style, currentSkill.buttonStyle);
    else {
      skillBtn.style.backgroundColor = "#ff4500";
      skillBtn.style.color = "white";
      skillBtn.style.border = "none";
    }

    let cost = 0;
    if (typeof currentSkill.getCost === "function") {
        cost = currentSkill.getCost();
    }
    
    const canAfford = (playerSkillPoint >= cost);
    const isMyTurn = (typeof cpuSide === 'undefined') || (turn !== cpuSide);
    const conditionMet = currentSkill.canUse();

    if (canAfford && isMyTurn && conditionMet) {
       skillBtn.disabled = false;
       skillBtn.style.opacity = 1.0;
       skillBtn.style.filter = "none";
    } else {
       skillBtn.disabled = true;
       skillBtn.style.opacity = 0.6;
       if (!canAfford) skillBtn.style.filter = "grayscale(100%)";
    }
  } else {
    skillBtn.style.display = "none";
  }
}

// --- ゲージ更新関数 ---
function addSkillPoint(amount) {
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
        const percentage = (playerSkillPoint / MAX_SKILL_POINT) * 100;
        bar.style.height = percentage + "%"; 
        text.textContent = Math.floor(playerSkillPoint);
    }
    if (costText && currentSkill && typeof currentSkill.getCost === "function") {
        const cost = currentSkill.getCost();
        costText.textContent = `Next: ${cost}pt`;
        costText.style.color = (playerSkillPoint >= cost) ? "#ffd700" : "#ff4500";
    }
}

function addCpuSkillPoint(amount) {
    cpuSkillPoint += amount;
    if (cpuSkillPoint > MAX_SKILL_POINT) cpuSkillPoint = MAX_SKILL_POINT;
    updateCpuSkillGaugeUI();
}

function consumeCpuSkillPoint(amount) {
    cpuSkillPoint -= amount;
    if (cpuSkillPoint < 0) cpuSkillPoint = 0;
    updateCpuSkillGaugeUI();
}

function updateCpuSkillGaugeUI() {
    const bar = document.getElementById("cpuSkillGaugeBar");
    const text = document.getElementById("cpuSkillGaugeText");

    if (bar && text) {
        const percentage = (cpuSkillPoint / MAX_SKILL_POINT) * 100;
        bar.style.height = percentage + "%";
        text.textContent = Math.floor(cpuSkillPoint);
        if (cpuSkillPoint >= MAX_SKILL_POINT) bar.classList.add("gauge-max"); 
        else bar.classList.remove("gauge-max");
    }
}

// ==========================================
// グラフ機能・SFEN生成・保存ロジック（ユーザ提供コードの復元）
// ==========================================

function generateSfen() {
    let sfen = "";
    for (let y = 0; y < 9; y++) {
        let emptyCount = 0;
        for (let x = 0; x < 9; x++) {
            const piece = boardState[y][x];
            if (piece) {
                if (emptyCount > 0) { sfen += emptyCount; emptyCount = 0; }
                sfen += piece; 
            } else emptyCount++;
        }
        if (emptyCount > 0) sfen += emptyCount;
        if (y < 8) sfen += "/";
    }
    sfen += (turn === "black" ? " b " : " w ");
    let handsStr = "";
    const order = ["R", "B", "G", "S", "N", "L", "P"]; 
    order.forEach(p => {
        const count = hands.black.filter(h => h === p).length;
        if (count === 1) handsStr += p;
        else if (count > 1) handsStr += count + p;
    });
    order.forEach(p => {
        const count = hands.white.filter(h => h === p).length;
        const lowerP = p.toLowerCase();
        if (count === 1) handsStr += lowerP;
        else if (count > 1) handsStr += count + lowerP;
    });
    if (handsStr === "") sfen += "-";
    else sfen += handsStr;
    sfen += " 1";
    return sfen;
}

function initChart() {
    const ctx = document.getElementById('evalChart').getContext('2d');
    if (typeof evalChart !== 'undefined' && evalChart) evalChart.destroy();
    const scaleSelect = document.getElementById("scaleSelect");
    if (!scaleSelect) return;
    const initialScale = scaleSelect.value;
    const step = getStepSize(initialScale); 
    evalChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: '評価値', data: evalHistory, borderColor: '#ff4500', backgroundColor: 'rgba(255, 69, 0, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 2, showLine: true }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: -parseInt(initialScale), max: parseInt(initialScale), grid: { color: c=>c.tick&&(Math.abs(c.tick.value)<0.1?'#333':'#eee'), lineWidth: c=>c.tick&&(Math.abs(c.tick.value)<0.1?2:1) }, ticks: { stepSize: step, autoSkip: false, maxTicksLimit: 100 } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });
}

function updateChart() {
    if(!evalChart) return; 
    while(evalChart.data.labels.length < evalHistory.length) evalChart.data.labels.push(evalChart.data.labels.length.toString()); 
    while(evalChart.data.labels.length > evalHistory.length) evalChart.data.labels.pop(); 
    const mode = document.getElementById("modeSelect").value; 
    const dataset = evalChart.data.datasets[0]; 
    if(mode === "winrate") dataset.data = evalHistory.map(score => calculateWinRate(score)); 
    else dataset.data = [...evalHistory]; 
    evalChart.update();
    const latestScore = evalHistory[evalHistory.length - 1] || 0;
    const winRate = calculateWinRate(latestScore).toFixed(1);
    const scoreStr = (latestScore > 0 ? "+" : "") + latestScore;
    const evalElem = document.getElementById("numericEval");
    if (evalElem) {
        evalElem.textContent = `評価値: ${scoreStr} / 勝率: ${winRate}%`;
        if (latestScore > 200) evalElem.style.color = "red";
        else if (latestScore < -200) evalElem.style.color = "blue";
        else evalElem.style.color = "#333";
    }
}

function updateChartSettings() { 
    if(!evalChart) return; 
    const mode = document.getElementById("modeSelect").value; 
    const scaleVal = document.getElementById("scaleSelect").value; 
    const scaleSelectParams = document.getElementById("scaleSelect");
    if(mode === "winrate") { 
        evalChart.options.scales.y.min = 0; evalChart.options.scales.y.max = 100; evalChart.options.scales.y.ticks.stepSize = 25; scaleSelectParams.disabled = true; 
    } else { 
        const yAxis = evalChart.options.scales.y; 
        if(scaleVal === "auto") { delete yAxis.min; delete yAxis.max; delete yAxis.ticks.stepSize; } 
        else { const num = parseInt(scaleVal, 10); yAxis.min = -num; yAxis.max = num; yAxis.ticks.stepSize = getStepSize(scaleVal); } 
        scaleSelectParams.disabled = false; 
    } 
    updateChart(); 
}

function toggleGraph() { 
    const area = document.getElementById("graphArea"); 
    if(!area) return; 
    if(area.style.display === "none") { 
        area.style.display = "flex"; 
        if(evalChart) setTimeout(() => { evalChart.resize(); updateChart(); }, 50); 
    } else { area.style.display = "none"; } 
}

function calculateWinRate(s) { return 1/(1+Math.exp(-s/1200))*100; }
function getStepSize(s) { if(s==="auto") return undefined; const r=parseInt(s,10); if(r<=500)return 100; if(r<=1000)return 200; if(r<=2000)return 500; if(r<=5000)return 1000; return 2000; }

function saveGameResult(res) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const opponentDisplayName = window.opponentName || "試験実装AI (最強)";
    const playerColor = (cpuSide === "white" ? "black" : "white");
    const isWin = (res === playerColor);
    const gameRecord = { date: new Date(), opponent: opponentDisplayName, moves: moveCount, result: isWin ? "WIN" : "LOSE", mode: "yaneuraou", kifuData: kifu };
    if (typeof updateMissionProgress === "function") { updateMissionProgress("play", 1); if(isWin) updateMissionProgress("win", 1); }
    db.collection("users").doc(user.uid).update({ win: firebase.firestore.FieldValue.increment(isWin ? 1 : 0), lose: firebase.firestore.FieldValue.increment(isWin ? 0 : 1), history: firebase.firestore.FieldValue.arrayUnion(gameRecord) }).then(() => console.log("保存完了")).catch(e => console.error(e));
}

// ユーティリティ
function updateHandLayout(playerRole) {
    const leftSide = document.querySelector(".side.left");
    const rightSide = document.querySelector(".side.right");
    const blackBox = document.getElementById("blackHandBox");
    const whiteBox = document.getElementById("whiteHandBox");
    if (!leftSide || !rightSide || !blackBox || !whiteBox) return;
    if (playerRole === "white") {
        blackBox.classList.remove("black-hand"); blackBox.classList.add("white-hand"); 
        whiteBox.classList.remove("white-hand"); whiteBox.classList.add("black-hand"); 
        leftSide.prepend(blackBox); rightSide.appendChild(whiteBox);
    } else {
        blackBox.classList.remove("white-hand"); blackBox.classList.add("black-hand");
        whiteBox.classList.remove("black-hand"); whiteBox.classList.add("white-hand");
        leftSide.prepend(whiteBox); rightSide.appendChild(blackBox);
    }
}
function deepCopyState() {
    return { boardState: JSON.parse(JSON.stringify(boardState)), hands: JSON.parse(JSON.stringify(hands)), turn: turn, moveCount: moveCount, kifu: JSON.parse(JSON.stringify(kifu)), lastMoveTo: lastMoveTo ? { ...lastMoveTo } : null, lastMoveFrom: lastMoveFrom ? { ...lastMoveFrom } : null };
}
function applyUserSkin() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    db.collection("users").doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data(); const equipped = data.equipped || {};
            if (typeof GAME_ITEMS !== 'undefined') {
                if (equipped.piece) { const item = GAME_ITEMS.find(i => i.id === equipped.piece); if (item && item.image) document.documentElement.style.setProperty('--piece-img', `url('${item.image}')`); }
                if (equipped.board) { const item = GAME_ITEMS.find(i => i.id === equipped.board); if (item && item.image) document.documentElement.style.setProperty('--board-img', `url('${item.image}')`); }
                if (equipped.bgm) { const item = GAME_ITEMS.find(i => i.id === equipped.bgm); if (item && item.src) { const bgmEl = document.getElementById("bgm"); if (bgmEl) bgmEl.src = item.src; } }
            }
        }
    }).catch(console.error);
}
function toggleMenu() { const p = document.getElementById('menuPanel'); if(p) p.style.display=(p.style.display==='none')?'block':'none'; }
function toggleVolume() { const m = document.getElementById("volumeModal"); if(m) m.style.display="flex"; }
function updateVolume() { const b=document.getElementById("bgm"), r=document.getElementById("bgmRange"); if(b&&r){ b.volume=r.value; b.muted=false; } }
function closeVolumeModal() { document.getElementById("volumeModal").style.display="none"; }
function showRules() { document.getElementById("rulesModal").style.display="flex"; }
function closeRulesModal() { document.getElementById("rulesModal").style.display="none"; }
function toggleKifu() { const a=document.getElementById("kifuArea"); if(a.style.display==="none"){ a.style.display="flex"; const s=document.getElementById("kifu"); if(s) setTimeout(()=>{s.scrollTop=s.scrollHeight},50); }else{ a.style.display="none"; } }
function copyKifuText() { const d=document.getElementById("kifu"); if(d) navigator.clipboard.writeText(d.innerText).then(()=>alert("棋譜をコピーしました！")); }
window.onclick=function(e){ if(!e.target.matches('#menuTrigger')){ const p=document.getElementById('menuPanel'); if(p&&p.style.display==='block') p.style.display='none'; }};

// ポップアップのボタンから呼ばれる関数
function resolvePromotion(doPromote) {
  const modal = document.getElementById("promoteModal");
  if (modal) modal.style.display = "none";
  if (pendingMove) {
    executeMove(pendingMove.sel, pendingMove.x, pendingMove.y, doPromote);
    pendingMove = null;
  }
}

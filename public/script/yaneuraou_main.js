// script/yaneuraou_main.js
// やねうら王専用メインスクリプト（完全修正・機能統合版）

// --- ★やねうら王用 設定変数 ---
let usiHistory = []; 
let isEngineReady = false; 
let evalHistory = [0]; 
let evalChart = null; 
let isPondering = false; 
let ponderTimer = null;
let isStoppingPonder = false;
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

// ★ポイント設定
const SP_CONFIG = {
  MOVE: { "P": 5, "+P": 15, "L": 8, "+L": 15, "N": 8, "+N": 15, "S": 10, "+S": 15, "G": 10, "B": 15, "+B": 30, "R": 15, "+R": 30, "K": 20 },
  DROP: { "P": 10, "L": 12, "N": 12, "S": 15, "G": 15, "B": 20, "R": 20 },
  CAPTURE: { "P": 10, "+P": 30, "L": 20, "+L": 40, "N": 20, "+N": 40, "S": 30, "+S": 50, "G": 40, "B": 60, "+B": 100, "R": 60, "+R": 100, "K": 1000 },
  PROMOTE: { "P": 20, "L": 25, "N": 25, "S": 30, "B": 50, "R": 50 }
};

// DOM要素
const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");


// --- 初期化処理 ---
window.addEventListener("load", () => {
  if (typeof skillUseCount !== 'undefined') skillUseCount = 0;

  bgm = document.getElementById("bgm");
  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  if (resignBtn) {
    resignBtn.addEventListener("click", resignGame);
  }

  // 1. 先手・後手のランダム決定
  const isPlayerBlack = Math.random() < 0.5;

  if (isPlayerBlack) {
      cpuSide = "white"; // AIは後手
      document.body.classList.remove("view-white");
      updateHandLayout("black");
  } else {
      cpuSide = "black"; // AIは先手
      document.body.classList.add("view-white");
      updateHandLayout("white");
  }

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
  
  initChart();

  // エンジン起動
  if (typeof initEngine === 'function') {
      console.log("ロードちゅう…");
      statusDiv.textContent = "ロードちゅう…";
      initEngine(); 
      setTimeout(() => {
          if(!isEngineReady) sendToEngine("usi");
      }, 1000);
  } else {
      console.error("engine_bridge.js が読み込まれていません！");
      statusDiv.textContent = "エラー: エンジンが見つかりません";
  }
  
  firebase.auth().onAuthStateChanged(function(user) {
        if (user) applyUserSkin();
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
        if (turn === "white") score = -score;
        
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
        if (cpuSide === "white") statusDiv.textContent = "対局開始！ あなたは【先手】です。";
        else statusDiv.textContent = "対局開始！ あなたは【後手】です。";
        console.log("Ready OK!");

        if (turn === cpuSide) setTimeout(() => cpuMove(), 1000);
    }
    else if (typeof msg === "string" && msg.startsWith("bestmove")) {
        const parts = msg.split(" ");
        const bestMove = parts[1];
        
        if (isStoppingPonder) {
             console.log("Ponder停止によるbestmoveを無視");
             isStoppingPonder = false;
             return;
        }
        if (turn !== cpuSide) return;
        
        if (bestMove === "resign") {
            resignGame(); 
        } else if (bestMove === "win") {
            statusDiv.textContent = "エンジンの勝ち宣言";
            gameOver = true;
        } else {
            applyUsiMove(bestMove);
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
    // ★重要修正：isCpuDoubleAction を追加
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
        
        // ★修正：player情報を付与
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
        
        // ★修正：player情報を付与
        sel = { x: fromX, y: fromY, fromHand: false, player: turn };
        doPromote = isPromote;
    }
    executeMove(sel, toX, toY, doPromote);
}

// 実際の移動処理
function executeMove(sel, x, y, doPromote) {
  if (typeof stopPondering === "function") stopPondering();

  // ▼ CPU必殺技発動チェック ▼
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

  if (sel.fromHand) lastMoveFrom = null;
  else lastMoveFrom = { x: sel.x, y: sel.y };

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
        promoteSound.play().catch(() => {});
      }
      const boardTable = document.getElementById("board");
      if (boardTable) {
        boardTable.classList.remove("flash-green", "flash-orange");
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

  const usiMove = convertToUsi(sel, x, y, doPromote, pieceBefore);
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
      if (!gameOver) setTimeout(() => { cpuMove(); }, 100);
  } else {
      turn = turn === "black" ? "white" : "black";
      window.isCaptureRestricted = false;
      selected = null;
      legalMoves = [];
      render(); 
      if (typeof showKifu === "function") showKifu();
      if (!gameOver) startTimer();
      else stopTimer();
      moveCount++;
      if (turn === cpuSide && !gameOver) setTimeout(() => cpuMove(), 1000);
  }

  // ★ ポイント加算 ★
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

  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
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

      if (typeof stopPondering === "function") stopPondering();
      const result = currentSkill.execute(x, y);

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

      if (typeof currentSkill.getCost === "function") {
          consumeSkillPoint(currentSkill.getCost());
      }

      history.push(deepCopyState());
      const boardTable = document.getElementById("board");
      if (boardTable) boardTable.classList.remove("skill-targeting-mode");

      const endsTurn = (currentSkill.endsTurn !== false);
      window.skillUsed = true; 
      if (typeof skillUseCount !== 'undefined') skillUseCount++;
      usiHistory = []; 

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

      const sfen = generateSfen();
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

  if (cpuEnabled && turn === cpuSide) return;

  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;
    const isWhite = piece === piece.toLowerCase();
    if ((turn === "black" && isWhite) || (turn === "white" && !isWhite)) return;
    
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

// 描画・ユーティリティ (ここから下も重要です)
function render() {
  if (!board) return;
  if (gameOver) {
    if (winner === "black") statusDiv.textContent = "あなたの勝ちです！";
    else if (winner === "white") statusDiv.textContent = "AI（試験実装）の勝ちです！";
    else statusDiv.textContent = "引き分けです。";
    checkStatusDiv.textContent = "";

    if (!hasShownEndEffect) {
        if (winner === "black") playSkillEffect("shori.PNG", "shori.mp3", null);
        else if (winner === "white") playSkillEffect("haiboku.PNG", "haiboku.mp3", null);
        hasShownEndEffect = true; 
    }
    if (!document.getElementById("resetBtn")) {
       const btn = document.createElement("button");
       btn.id = "resetBtn";
       btn.textContent = "ホームに戻る"; 
       Object.assign(btn.style, {
           padding: "10px 20px", marginTop: "15px", fontSize: "16px",
           backgroundColor: "#d32f2f", color: "white", border: "none",
           borderRadius: "5px", cursor: "pointer", fontWeight: "bold"
       });
       btn.onclick = () => { window.location.href = "home.html"; };
       statusDiv.appendChild(document.createElement("br"));
       statusDiv.appendChild(btn);
    }
  } else {
    if (!isSkillTargeting) {
      let msg = "現在の手番：" + (turn === "black" ? "先手" : "後手") + " / 手数：" + moveCount;
      if (window.isCaptureRestricted) msg += " 【攻撃禁止中】";
      msg += (isKingInCheck(turn) ? "　王手！" : "");
      statusDiv.textContent = msg;
    }
  }

  board.innerHTML = "";
  for (let y = 0; y < 9; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < 9; x++) {
      const td = document.createElement("td");
      const piece = boardState[y][x];
      
      if (piece) {
        const isWhite = piece === piece.toLowerCase();
        const key = piece.startsWith("+") ? "+" + piece.replace("+","").toUpperCase() : piece.toUpperCase();
        
        const container = document.createElement("div");
        container.className = "piece-container";
        if (isWhite) container.classList.add("gote");
        const baseType = piece.replace("+", "").toUpperCase();
        container.classList.add("size-" + baseType);
        
        const textSpan = document.createElement("span");
        textSpan.className = "piece-text";
        if (key.startsWith("+")) textSpan.classList.add("promoted");
        
        const name = (typeof pieceName !== 'undefined') ? pieceName[key] : key;
        textSpan.textContent = name.length > 1 ? name[name.length - 1] : name;

        if (pieceStyles[y][x] === "green") {
          textSpan.style.color = "#32CD32";
          textSpan.style.fontWeight = "bold";
          textSpan.style.textShadow = "1px 1px 0px #000";
        } else if (pieceStyles[y][x] === "blue") {
          textSpan.style.color = "#1E90FF";
          textSpan.style.fontWeight = "bold";
          textSpan.style.textShadow = "1px 1px 0px #000";
        } else if (pieceStyles[y][x] === "silver") {
          textSpan.style.color = "#C0C0C0";
          textSpan.style.fontWeight = "bold";
          textSpan.style.textShadow = "1px 1px 0px #000";
        } else if (pieceStyles[y][x] === "orange") {
          textSpan.style.color = "#FFA500";
          textSpan.style.fontWeight = "bold";
          textSpan.style.textShadow = "1px 1px 0px #000";
        }

        container.appendChild(textSpan);
        td.appendChild(container);
        if (isWhite) td.style.transform = "rotate(180deg)";
        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) td.classList.add("moved");
      }
      if (lastMoveFrom && lastMoveFrom.x === x && lastMoveFrom.y === y) td.classList.add("move-from");
      if (selected && !selected.fromHand && selected.x === x && selected.y === y) td.classList.add("selected");
      if (legalMoves.some(m => m.x === x && m.y === y)) td.classList.add("move");
      
      td.onclick = () => onCellClick(x, y);
      tr.appendChild(td);
    }
    board.appendChild(tr);
  }
  renderHands();
  
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

function renderHands() {
  const order = ["P", "L", "N", "S", "G", "B", "R"];
  hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  blackHandDiv.innerHTML = "";
  whiteHandDiv.innerHTML = "";

  const createHandPiece = (player, p, i) => {
      const container = document.createElement("div");
      container.className = "hand-piece-container";
      if (player === "white") container.classList.add("gote");
      const textSpan = document.createElement("span");
      textSpan.className = "piece-text";
      textSpan.textContent = (typeof pieceName !== 'undefined') ? pieceName[p] : p;
      container.appendChild(textSpan);

      if (selected && selected.fromHand && selected.player === player && selected.index === i) {
          container.classList.add("selected");
      }
      container.onclick = () => selectFromHand(player, i);
      if (player === cpuSide) container.style.transform = "rotate(180deg)";
      return container;
  };

  hands.black.forEach((p, i) => blackHandDiv.appendChild(createHandPiece("black", p, i)));
  hands.white.forEach((p, i) => whiteHandDiv.appendChild(createHandPiece("white", p, i)));
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
        a.volume = 1.0;
        a.play().catch(e => {});
      });
    } else {
      const audio = document.getElementById("skillSound");
      if (audio) {
        audio.src = "script/audio/" + soundName;
        audio.volume = 1.0;
        audio.play().catch(e => {});
      }
    }
  }
  const boardTable = document.getElementById("board");
  if (boardTable && flashColor) {
    boardTable.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red", "flash-blue", "flash-yellow");
    void boardTable.offsetWidth; 
    if (flashColor) boardTable.classList.add("flash-" + flashColor);
  }
}

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

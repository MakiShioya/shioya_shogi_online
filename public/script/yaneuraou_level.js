// script/yaneuraou_level.js

// --- ★レベル別設定テーブル ---
const LEVEL_CONFIG = {
    1:  { nodes: 10,     name: "Lv1 (入門)" },    // 10ノード（激弱・即指し）
    2:  { nodes: 50,     name: "Lv2 (初心)" },
    3:  { nodes: 100,    name: "Lv3 (初級)" },
    4:  { nodes: 300,    name: "Lv4 (初級+)" },
    5:  { nodes: 1000,   name: "Lv5 (中級)" },
    10: { nodes: 10000,  name: "Lv10 (上級)" },   // ここから先読み有効にする
    15: { nodes: 100000, name: "Lv15 (有段)" },
    20: { nodes: 1000000,name: "Lv20 (最強)" }
};

// URLパラメータからレベルを取得
const urlParams = new URLSearchParams(window.location.search);
const lvParam = parseInt(urlParams.get('lv')) || 1;
// 設定をロード（存在しないレベルならLv1にする）
const currentLevelInfo = LEVEL_CONFIG[lvParam] || LEVEL_CONFIG[1];

// ---------------------------------------------------

let usiHistory = [];
let isEngineReady = false;
let evalHistory = [0];
let evalChart = null;
let isPondering = false;
let ponderTimer = null;
let isStoppingPonder = false;
let hasShownEndEffect = false;

// ★必殺技・ゲージ関連
window.skillUsed = false;
window.isCaptureRestricted = false;
let lastSkillKifu = "";
let pendingMove = null;
let isCpuDoubleAction = false;
let cpuSkillUseCount = 0;
let playerSkillPoint = 0;
let cpuSkillPoint = 0;
const MAX_SKILL_POINT = 1000;

const SP_CONFIG = {
  MOVE: { "P": 5, "+P": 10, "L": 8, "+L": 13, "N": 8, "+N": 13, "S": 10, "+S": 15, "G": 10, "B": 15, "+B": 20, "R": 15, "+R": 20, "K": 20 },
  DROP: { "P": 10, "L": 13, "N": 13, "S": 15, "G": 15, "B": 20, "R": 20 },
  CAPTURE: { "P": 5, "+P": 10, "L": 8, "+L": 13, "N": 8, "+N": 13, "S": 10, "+S": 15, "G": 10, "B": 15, "+B": 20, "R": 15, "+R": 20, "K": 1000 },
  PROMOTE: { "P": 5, "L": 5, "N": 5, "S": 5, "B": 5, "R": 5 }
};

const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");

window.addEventListener("load", () => {
  bgm = document.getElementById("bgm");
  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  if (resignBtn) resignBtn.addEventListener("click", resignGame);

  const isPlayerBlack = Math.random() < 0.5;
  if (isPlayerBlack) {
      cpuSide = "white";
      document.body.classList.remove("view-white");
      updateHandLayout("black");
  } else {
      cpuSide = "black";
      document.body.classList.add("view-white");
      updateHandLayout("white");
  }

  applyPlayerImage();

  const charId = sessionStorage.getItem('char_black') || 'default';
  if (charId === 'default' && typeof CharItsumono !== 'undefined') currentSkill = CharItsumono.skill;
  else if (charId === 'char_a' && typeof CharNekketsu !== 'undefined') currentSkill = CharNekketsu.skill;
  else if (charId === 'char_b' && typeof CharReisei !== 'undefined') currentSkill = CharReisei.skill;
  else if (charId === 'char_d' && typeof CharMachida !== 'undefined') currentSkill = CharMachida.skill;

  updateSkillButton();
  playBGM();
  startTimer();
  render();
  if (typeof showKifu === "function") showKifu();

  const key = getPositionKey();
  positionHistory[key] = 1;
  initChart();

  if (typeof initEngine === 'function') {
      console.log("ロードちゅう…");
      statusDiv.textContent = "ロードちゅう…";
      initEngine();
      setTimeout(() => {
          if(!isEngineReady) sendToEngine("usi");
      }, 1000);
  } else {
      statusDiv.textContent = "エラー: エンジンが見つかりません";
  }
  
  firebase.auth().onAuthStateChanged(function(user) {
      if (user) applyUserSkin();
  });
});

function sendToEngine(msg) {
    if (typeof engineWorker !== 'undefined' && engineWorker) {
        engineWorker.postMessage(msg);
    }
}

// ★ここが重要：エンジンからのメッセージ処理
function handleEngineMessage(msg) {
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
        sendToEngine("isready");
    }
    else if (msg === "readyok") {
        isEngineReady = true;
        
        // ▼▼▼ 【重要】定跡をオフにする ▼▼▼
        console.log("定跡をオフにします...");
        sendToEngine("setoption name BookFile value no_book"); 
        // ▲▲▲

        statusDiv.textContent = (cpuSide === "white") ? "対局開始！ あなたは【先手】です。" : "対局開始！ あなたは【後手】です。";
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
            if (!gameOver) setTimeout(startPondering, 500);
        }
    }
}

// ★ここが重要：AI思考処理（フリーズ対策済）
function cpuMove() {
    if (gameOver) return;
    if (!isEngineReady) {
        statusDiv.textContent = "エンジン起動待ち...";
        setTimeout(cpuMove, 1000);
        return;
    }

    // ▼▼▼ 【重要】前の思考を確実に止める ▼▼▼
    stopPondering(); 
    // ▲▲▲

    statusDiv.textContent = `考え中... (${currentLevelInfo.name})`;
    let positionCmd = "";

    if ((typeof skillUsed !== 'undefined' && skillUsed) || usiHistory.length === 0 || isCpuDoubleAction) {
        const sfen = generateSfen();
        positionCmd = "position sfen " + sfen;
    } 
    else {
        positionCmd = "position startpos moves " + usiHistory.join(" ");
    }
    sendToEngine(positionCmd);

    const nodesLimit = currentLevelInfo.nodes;
    console.log(`Level:${lvParam} -> Nodes:${nodesLimit} で思考開始`);

    // ▼▼▼ 【重要】シンプルに nodes だけ指定して送る ▼▼▼
    sendToEngine(`go nodes ${nodesLimit}`);
}

// ★ここが重要：先読み処理（レベル分け対応済）
function startPondering() {
    if (gameOver || isPondering) return;

    // ▼▼▼ 【重要】Lv10未満は先読みしない（弱くするため） ▼▼▼
    if (currentLevelInfo.nodes < 10000) {
        return; 
    }
    // ▲▲▲

    let positionCmd = "";
    if (typeof skillUsed !== 'undefined' && skillUsed) {
        positionCmd = "position sfen " + generateSfen();
    } else {
        positionCmd = "position startpos moves " + usiHistory.join(" ");
    }
    sendToEngine(positionCmd);
    
    // 強いレベルだけ全力で考えさせる
    sendToEngine("go infinite");
    
    isPondering = true;
    statusDiv.textContent = `相手の手番中も考え中... (先読み)`;

    if (ponderTimer) clearTimeout(ponderTimer);
    ponderTimer = setTimeout(() => {
        if (isPondering) {
            stopPondering();
        }
    }, 60000); // 長すぎる場合は1分で休憩
}

function stopPondering() {
    if (isPondering) {
        isStoppingPonder = true; 
        sendToEngine("stop");
        isPondering = false;
        if (ponderTimer) {
            clearTimeout(ponderTimer);
            ponderTimer = null;
        }
    }
}

// --- 以下、既存の関数群（変更なし） ---

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
  if (turn === cpuSide && !gameOver) {
      alert("待ったができるのは自分の手番だけ！");
      return; 
  }
  if (isSkillTargeting) {
    isSkillTargeting = false;
    legalMoves = [];
    render();
    return;
  }
  if (history.length < 2 || gameOver) return;
  
  const prev = history[history.length - 2];
  history.length -= 2; 

  if (evalHistory.length > 2) {
      evalHistory.length -= 2;
      updateChart();
  }

  if (usiHistory.length >= 2) {
      usiHistory.length -= 2;
  }

  boardState = JSON.parse(JSON.stringify(prev.boardState));
  hands = JSON.parse(JSON.stringify(prev.hands));
  turn = prev.turn;
  moveCount = prev.moveCount;
  kifu = JSON.parse(JSON.stringify(prev.kifu));
  lastMoveTo = prev.lastMoveTo ? { ...prev.lastMoveTo } : null;
  lastMoveFrom = prev.lastMoveFrom ? { ...prev.lastMoveFrom } : null;

  window.isCaptureRestricted = false;
  gameOver = false;
  winner = null;
  statusDiv.textContent = "";
  checkStatusDiv.textContent = "";

  render();
  if (typeof showKifu === "function") showKifu();
  startTimer();
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

function render() {
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
        btn.style.cssText = "padding:10px 20px; margin-top:15px; font-size:16px; background-color:#d32f2f; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;";
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
        
        const name = pieceName[key];
        textSpan.textContent = name.length > 1 ? name[name.length - 1] : name;

        if (pieceStyles[y][x] === "green") {
          textSpan.style.color = "#32CD32";
          textSpan.style.fontWeight = "bold";
          textSpan.style.textShadow = "1px 1px 0px #000";
        } else if (pieceStyles[y][x] === "blue") {
          textSpan.style.color = "#1E90FF";
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
      textSpan.textContent = pieceName[p];
      
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

function onCellClick(x, y) {
  if (gameOver) return;
  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      if (currentSkill && currentSkill.isSystemAction) {
        if (typeof stopPondering === "function") stopPondering();
        currentSkill.execute(x, y);
        isSkillTargeting = false;
        legalMoves = [];
        selected = null;
        const boardTable = document.getElementById("board");
        if (boardTable) boardTable.classList.remove("skill-targeting-mode");
        if (typeof undoMove === "function") undoMove();
        skillUseCount++; 
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

      if (typeof currentSkill.getCost === "function") consumeSkillPoint(currentSkill.getCost());
      history.push(deepCopyState());
      const boardTable = document.getElementById("board");
      if (boardTable) boardTable.classList.remove("skill-targeting-mode");
      const endsTurn = (currentSkill.endsTurn !== false);
      window.skillUsed = true; 
      skillUseCount++;
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
      console.log("必殺技発動！SFEN送信:", sfen);
      sendToEngine("position sfen " + sfen);
      if(currentSkill.reset) currentSkill.reset();
      isSkillTargeting = false;
      legalMoves = [];
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
    if (window.isCaptureRestricted) legalMoves = legalMoves.filter(m => boardState[m.y][m.x] === "");
    render();
    return;
  }

  const sel = selected;
  if (legalMoves.some(m => m.x === x && m.y === y)) {
    movePieceWithSelected(sel, x, y);
  }
  selected = null;
  legalMoves = [];
  render();
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
      if (modal) modal.style.display = "flex";
      else {
          if(confirm("成りますか？")) executeMove(sel, x, y, true);
          else executeMove(sel, x, y, false);
      }
    }
  } else {
    executeMove(sel, x, y, false);
  }
}

function executeMove(sel, x, y, doPromote) {
  // ★重要：こちらが手を指した瞬間も、AIの先読みを止める
  if (typeof stopPondering === "function") stopPondering();

  if (!gameOver && turn === cpuSide && !isCpuDoubleAction && typeof CpuDoubleAction !== 'undefined') {
      const cost = CpuDoubleAction.getCost();
      if (cpuSkillPoint >= cost) {
          consumeCpuSkillPoint(cost);
          isCpuDoubleAction = true;
          cpuSkillUseCount++;
          playSkillEffect("boss_cutin.png", ["boss.mp3", "skill.mp3"], "dark"); 
          statusDiv.textContent = `CPUが必殺技【${CpuDoubleAction.name}】を発動！`;
          setTimeout(() => { executeMove(sel, x, y, doPromote); }, 1500);
          return; 
      }
  }
  const pieceBefore = sel.fromHand ? hands[sel.player][sel.index] : boardState[sel.y][sel.x];
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

  const usiMove = convertToUsi(sel, x, y, doPromote, pieceBefore);
  if (!window.skillUsed) usiHistory.push(usiMove);

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
      if (isPlayerAction) addSkillPoint(gain);
      else addCpuSkillPoint(gain);
  }
  checkGameOver();
}

function convertToUsi(sel, toX, toY, promoted, pieceName) {
    const fileTo = 9 - toX;
    const rankTo = String.fromCharCode(97 + toY);
    if (sel.fromHand) {
        const pieceChar = pieceName.replace("+","").toUpperCase();
        return `${pieceChar}*${fileTo}${rankTo}`;
    }
    const fileFrom = 9 - sel.x;
    const rankFrom = String.fromCharCode(97 + sel.y);
    let moveStr = `${fileFrom}${rankFrom}${fileTo}${rankTo}`;
    if (promoted) moveStr += "+";
    return moveStr;
}

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
        sel = { x: fromX, y: fromY, fromHand: false, player: turn };
        doPromote = isPromote;
    }
    executeMove(sel, toX, toY, doPromote);
}

function generateSfen() {
    let sfen = "";
    for (let y = 0; y < 9; y++) {
        let emptyCount = 0;
        for (let x = 0; x < 9; x++) {
            const piece = boardState[y][x];
            if (piece) {
                if (emptyCount > 0) {
                    sfen += emptyCount;
                    emptyCount = 0;
                }
                sfen += piece; 
            } else {
                emptyCount++;
            }
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
        const lowerP = p.toLowerCase();
        const count = hands.white.filter(h => h === p).length;
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
    const initialScale = document.getElementById("scaleSelect").value;
    const step = getStepSize(initialScale);
    evalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [{
                label: '評価値 (先手有利がプラス)',
                data: evalHistory,
                borderColor: '#ff4500',
                backgroundColor: 'rgba(255, 69, 0, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 2,
                showLine: true  
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: -parseInt(initialScale), 
                    max: parseInt(initialScale),   
                    grid: { 
                        color: (context) => {
                            if (!context.tick) return '#eee';
                            const val = context.tick.value;
                            const modeElem = document.getElementById("modeSelect");
                            const mode = modeElem ? modeElem.value : "score";
                            if (mode === "winrate") return (Math.abs(val - 50) < 0.1) ? '#999' : '#eee';
                            return (Math.abs(val) < 0.1) ? '#333' : '#eee';
                        },
                        lineWidth: (context) => {
                            if (!context.tick) return 1;
                            const val = context.tick.value;
                            const modeElem = document.getElementById("modeSelect");
                            const mode = modeElem ? modeElem.value : "score";
                            if (mode === "winrate") return (Math.abs(val - 50) < 0.1) ? 2 : 1;
                            return (Math.abs(val) < 0.1) ? 2 : 1;
                        }
                    },
                    ticks: {
                        stepSize: step,
                        autoSkip: false,   
                        maxTicksLimit: 100 
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function updateChartSettings() {
    if (!evalChart) return;
    const mode = document.getElementById("modeSelect").value;
    const scaleVal = document.getElementById("scaleSelect").value;
    const scaleSelectParams = document.getElementById("scaleSelect");
    if (mode === "winrate") {
        evalChart.options.scales.y.min = 0;
        evalChart.options.scales.y.max = 100;
        evalChart.options.scales.y.ticks.stepSize = 25;
        evalChart.data.datasets[0].label = "期待勝率 (%)";
        scaleSelectParams.disabled = true;
    } else {
        const yAxis = evalChart.options.scales.y;
        if (scaleVal === "auto") {
            delete yAxis.min;
            delete yAxis.max;
            delete yAxis.ticks.stepSize; 
        } else {
            const num = parseInt(scaleVal, 10);
            yAxis.min = -num;
            yAxis.max = num;
            yAxis.ticks.stepSize = getStepSize(scaleVal);
        }
        evalChart.data.datasets[0].label = "評価値 (先手有利がプラス)";
        scaleSelectParams.disabled = false;
    }
    updateChart();
}

function updateChart() {
    if (!evalChart) return;
    while(evalChart.data.labels.length < evalHistory.length) {
        evalChart.data.labels.push((evalChart.data.labels.length).toString());
    }
    while(evalChart.data.labels.length > evalHistory.length) {
        evalChart.data.labels.pop();
    }
    const mode = document.getElementById("modeSelect").value;
    const dataset = evalChart.data.datasets[0];
    if (mode === "winrate") {
        dataset.data = evalHistory.map(score => calculateWinRate(score));
    } else {
        dataset.data = [...evalHistory];
    }
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

function resolvePromotion(doPromote) {
  const modal = document.getElementById("promoteModal");
  if (modal) modal.style.display = "none";
  if (pendingMove) {
    executeMove(pendingMove.sel, pendingMove.x, pendingMove.y, doPromote);
    pendingMove = null;
  }
}

function toggleGraph() {
    const area = document.getElementById("graphArea");
    if (!area) return;
    if (area.style.display === "none") {
        area.style.display = "flex"; 
        if (evalChart) {
            setTimeout(() => {
                evalChart.resize();
                updateChart();
            }, 50);
        }
    } else {
        area.style.display = "none";
    }
}

function calculateWinRate(score) {
    return 1 / (1 + Math.exp(-score / 1200)) * 100;
}

function getStepSize(scaleVal) {
    if (scaleVal === "auto") return undefined; 
    const range = parseInt(scaleVal, 10);
    if (range <= 500) return 100;   
    if (range <= 1000) return 200;  
    if (range <= 2000) return 500;  
    if (range <= 5000) return 1000; 
    return 2000;                    
}

function toggleKifu() {
    const area = document.getElementById("kifuArea");
    if (area.style.display === "none") {
        area.style.display = "flex"; 
        const scrollBox = document.getElementById("kifu");
        if (scrollBox) setTimeout(() => { scrollBox.scrollTop = scrollBox.scrollHeight; }, 50);
    } else {
        area.style.display = "none";
    }
}

function toggleVolume() {
    const modal = document.getElementById("volumeModal");
    if (modal) modal.style.display = "flex";
}

function updateVolume() {
    const bgm = document.getElementById("bgm");
    const range = document.getElementById("bgmRange");
    if (bgm && range) {
        bgm.volume = range.value;
        bgm.muted = false;
    }
}

function closeVolumeModal() {
    document.getElementById("volumeModal").style.display = "none";
}

function showRules() {
    const modal = document.getElementById("rulesModal");
    if (modal) modal.style.display = "flex";
}

function closeRulesModal() {
    document.getElementById("rulesModal").style.display = "none";
}

function toggleMenu() {
    const panel = document.getElementById('menuPanel');
    if (panel) panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
}

function copyKifuText() {
    const kifuDiv = document.getElementById("kifu");
    if (kifuDiv) {
        navigator.clipboard.writeText(kifuDiv.innerText).then(() => {
            alert("棋譜をコピーしました！");
        });
    }
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
    winner = cpuSide; 
    saveGameResult(winner);
    render();
    if (typeof showKifu === "function") showKifu();
}

function closeResignModal() {
    const modal = document.getElementById("resignModal");
    if (modal) modal.style.display = "none";
}

function saveGameResult(res) {
    const user = auth.currentUser; 
    if (!user) {
        console.log("未ログインのため、記録は保存されません。");
        return; 
    }
    const opponentDisplayName = window.opponentName || "試験実装AI (最強)"; 
    const playerColor = (cpuSide === "white" ? "black" : "white");
    const isWin = (res === playerColor);
    
    const gameRecord = {
        date: new Date(),                
        opponent: opponentDisplayName,   
        moves: moveCount,                
        result: isWin ? "WIN" : "LOSE",  
        mode: "yaneuraou", 
        kifuData: kifu                   
    };

  if (typeof updateMissionProgress === "function") {
      updateMissionProgress("play", 1);
      if (isWin) updateMissionProgress("win", 1);
  }

    db.collection("users").doc(user.uid).update({
        win: firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
        lose: firebase.firestore.FieldValue.increment(isWin ? 0 : 1),
        history: firebase.firestore.FieldValue.arrayUnion(gameRecord)
    }).then(() => {
        console.log("対局データが正常に保存されました。");
    }).catch((error) => {
        console.error("保存失敗:", error);
    });
}

function updateHandLayout(playerRole) {
    const leftSide = document.querySelector(".side.left");
    const rightSide = document.querySelector(".side.right");
    const blackBox = document.getElementById("blackHandBox");
    const whiteBox = document.getElementById("whiteHandBox");
    if (!leftSide || !rightSide || !blackBox || !whiteBox) return;

    if (playerRole === "white") {
        blackBox.classList.remove("black-hand");
        blackBox.classList.add("white-hand"); 
        whiteBox.classList.remove("white-hand");
        whiteBox.classList.add("black-hand"); 
        leftSide.prepend(blackBox);
        rightSide.appendChild(whiteBox);
    } else {
        blackBox.classList.remove("white-hand");
        blackBox.classList.add("black-hand");
        whiteBox.classList.remove("black-hand");
        whiteBox.classList.add("white-hand");
        leftSide.prepend(whiteBox);
        rightSide.appendChild(blackBox);
    }
}

function deepCopyState() {
    return {
        boardState: JSON.parse(JSON.stringify(boardState)),
        hands: JSON.parse(JSON.stringify(hands)),
        turn: turn,
        moveCount: moveCount,
        kifu: JSON.parse(JSON.stringify(kifu)),
        lastMoveTo: lastMoveTo ? { ...lastMoveTo } : null,
        lastMoveFrom: lastMoveFrom ? { ...lastMoveFrom } : null,
    };
}

function applyUserSkin() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    db.collection("users").doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const equipped = data.equipped || {};
            if (typeof GAME_ITEMS !== 'undefined') {
                if (equipped.piece) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.piece);
                    if (item && item.image) document.documentElement.style.setProperty('--piece-img', `url('${item.image}')`);
                }
                if (equipped.board) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.board);
                    if (item && item.image) document.documentElement.style.setProperty('--board-img', `url('${item.image}')`);
                }
                if (equipped.bgm) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.bgm);
                    if (item && item.src) {
                        const bgmEl = document.getElementById("bgm");
                        if (bgmEl) bgmEl.src = item.src;
                    }
                }
            }
        }
    }).catch(console.error);
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

// script/game_core.js (Global Window Version)

const board = document.getElementById("board");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
// ★コールバック用変数
window.onTurnComplete = null;

// --- 描画関連 (render) ---
window.render = function() {

  if (!window.board) return;

  if (gameOver) {
    if (winner === "black") window.statusDiv.textContent = "先手の勝ちです！";
    else if (winner === "white") window.statusDiv.textContent = "後手の勝ちです！";
    else window.statusDiv.textContent = "引き分けです。";
    if(window.checkStatusDiv) window.checkStatusDiv.textContent = "";

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
       window.statusDiv.appendChild(document.createElement("br"));
       window.statusDiv.appendChild(btn);
    }
  } else {
    if (typeof isSkillTargeting !== 'undefined' && !isSkillTargeting) {
      let msg = "手番：" + (turn === "black" ? "先手" : "後手") + " / 手数：" + moveCount;
      if (window.isCaptureRestricted) msg += " 【攻撃禁止】";
      
      if (window.statusDiv && !window.statusDiv.textContent.includes("あなた")) {
          msg += (isKingInCheck(turn) ? "　王手！" : "");
          window.statusDiv.textContent = msg;
      }
    }
    if(window.checkStatusDiv) window.checkStatusDiv.textContent = "";
  }

  // 盤面描画
  window.board.innerHTML = "";
  if (!boardState || boardState.length === 0) return;

  for (let y = 0; y < 9; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < 9; x++) {
      const td = document.createElement("td");
      const piece = boardState[y][x];
      if (piece) {
        const isWhite = piece === piece.toLowerCase();
        const key = piece.startsWith("+") ? "+" + piece.replace("+","").toUpperCase() : piece.toUpperCase();
        td.textContent = (typeof pieceName !== 'undefined') ? pieceName[key] : key;
        if (isWhite) td.style.transform = "rotate(180deg)";
        
        if (pieceStyles[y][x] === "green") {
          td.style.color = "#32CD32";
          td.style.fontWeight = "bold";
          td.style.textShadow = "1px 1px 0px #000";
        }
        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) td.classList.add("moved");
      }
      if (selected && !selected.fromHand && selected.x === x && selected.y === y) td.classList.add("selected");
      if (typeof legalMoves !== 'undefined' && legalMoves.some(m => m.x === x && m.y === y)) td.classList.add("move");
      
      td.onclick = () => {
          if(typeof onCellClick === "function") onCellClick(x, y);
      };
      tr.appendChild(td);
    }
    window.board.appendChild(tr);
  }
  window.renderHands();

  if (window.blackHandDiv) window.blackHandDiv.classList.remove("active");
  if (window.whiteHandDiv) window.whiteHandDiv.classList.remove("active");

  if (!gameOver) {
    if (turn === "black" && window.blackHandDiv) window.blackHandDiv.classList.add("active");
    else if (turn === "white" && window.whiteHandDiv) window.whiteHandDiv.classList.add("active");
  }
  
  if(typeof updateSkillButton === "function") updateSkillButton();
};

// 持ち駒描画
window.renderHands = function() {
  if (!window.blackHandDiv || !window.whiteHandDiv) return;
  const order = ["P", "L", "N", "S", "G", "B", "R"];
  if (typeof hands === 'undefined') return;

  hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  window.blackHandDiv.innerHTML = "";
  window.whiteHandDiv.innerHTML = "";

  const createHandPiece = (player, p, i) => {
      const span = document.createElement("span");
      span.textContent = (typeof pieceName !== 'undefined') ? pieceName[p] : p;
      if (selected && selected.fromHand && selected.player === player && selected.index === i) span.classList.add("selected");
      span.onclick = () => {
          if(typeof selectFromHand === "function") selectFromHand(player, i);
      };
      return span;
  };

  hands.black.forEach((p, i) => window.blackHandDiv.appendChild(createHandPiece("black", p, i)));
  hands.white.forEach((p, i) => window.whiteHandDiv.appendChild(createHandPiece("white", p, i)));
};

// --- 移動実行 (executeMove) ---
window.executeMove = function(sel, x, y, doPromote) {
  history.push(deepCopyState());

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
      
      if (window.board) {
        window.board.classList.remove("flash-green", "flash-orange");
        void window.board.offsetWidth;
        if (base === "R") {
            window.board.classList.add("flash-green");
            setTimeout(() => window.board.classList.remove("flash-green"), 2000);
        } else if (base === "B") {
            window.board.classList.add("flash-orange");
            setTimeout(() => window.board.classList.remove("flash-orange"), 2000);
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

  turn = turn === "black" ? "white" : "black";
  window.isCaptureRestricted = false;
  
  // リセット
  selected = null;
  legalMoves = [];

  window.render(); 
  if (typeof showKifu === "function") showKifu();

  if (!gameOver) window.startTimer();
  else window.stopTimer();
  moveCount++;

  window.checkGameOver();

  if (typeof window.onTurnComplete === "function") {
      window.onTurnComplete();
  }
};

// 終了判定
window.checkGameOver = function() {
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    saveGameResult(null);
    window.render();
    return;
  }
  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";
    saveGameResult(winner);
    window.render();
    return;
  }
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();
  if (positionHistory[key] >= 4) {
    gameOver = true;
    winner = null;
    if(window.statusDiv) window.statusDiv.textContent = "千日手です。引き分け。";
    window.render();
  }
};

// --- 演出関連 ---
window.playSkillEffect = function(imageName, soundName, flashColor) {
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

  if (window.board && flashColor) {
    window.board.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red", "flash-blue");
    void window.board.offsetWidth; 
    window.board.classList.add("flash-" + flashColor);
  }
};

// --- タイマー関連 ---
let timerInterval = null;
let currentSeconds = 0;

window.startTimer = function() {
  window.stopTimer();
  currentSeconds = 0;
  window.updateTimerDisplay();
  timerInterval = setInterval(() => {
    currentSeconds++;
    window.updateTimerDisplay();
  }, 1000);
};

window.stopTimer = function() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

window.updateTimerDisplay = function() {
  const timerBox = document.getElementById("timerBox");
  if (timerBox) timerBox.textContent = "考慮時間: " + currentSeconds + "秒";
};

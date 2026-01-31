// script/main_player.js (Refactored for PvP)


// ★変数を window オブジェクトに登録（これでどこからでも見えるようになります）
window.board = document.getElementById("board");
window.statusDiv = document.getElementById("status");
window.checkStatusDiv = document.getElementById("checkStatus");
window.blackHandDiv = document.getElementById("blackHand");
window.whiteHandDiv = document.getElementById("whiteHand");

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
        const type = piece.startsWith("+") ? "+" + piece.replace("+","").toUpperCase() : piece.toUpperCase();
        const baseType = piece.replace("+", "").toUpperCase();
        const name = (typeof pieceName !== 'undefined') ? pieceName[type] : type;
        const isPromoted = piece.startsWith("+");

        // ★修正：駒を画像コンテナとして作成
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

        // スキル演出（グリーン）
        if (pieceStyles[y][x] === "green") {
          textSpan.style.color = "#32CD32";
          textSpan.style.textShadow = "1px 1px 2px #000";
        }

        container.appendChild(textSpan);
        td.appendChild(container);

        // 後手は180度回転
        if (isWhite) td.style.transform = "rotate(180deg)";
        else td.style.transform = "none";
        
        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) td.classList.add("moved");
      }
      if (lastMoveFrom && lastMoveFrom.x === x && lastMoveFrom.y === y) {
          td.classList.add("move-from");
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

  // --- 修正後のコード ---
  // 持ち駒エリアの枠（Box）を取得
  const blackBox = document.getElementById("blackHandBox");
  const whiteBox = document.getElementById("whiteHandBox");

  // 一旦両方の光を消す
  if (blackBox) blackBox.classList.remove("active");
  if (whiteBox) whiteBox.classList.remove("active");

  // 手番の側を光らせる
  if (!gameOver) {
    if (turn === "black" && blackBox) {
        blackBox.classList.add("active");
    } else if (turn === "white" && whiteBox) {
        whiteBox.classList.add("active");
    }
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
      // ★修正：持ち駒も画像コンテナ化
      const container = document.createElement("div");
      container.className = "hand-piece-container";
      if (player === "white") {
          container.classList.add("gote");
      }
      const textSpan = document.createElement("span");
      textSpan.className = "piece-text";
      textSpan.textContent = (typeof pieceName !== 'undefined') ? pieceName[p] : p;

      container.appendChild(textSpan);

      if (selected && selected.fromHand && selected.player === player && selected.index === i) container.classList.add("selected");
      
      container.onclick = () => {
          if(typeof selectFromHand === "function") selectFromHand(player, i);
      };

      // 後手は反転
      if (player === "white") container.style.transform = "rotate(180deg)";

      return container;
  };

  hands.black.forEach((p, i) => window.blackHandDiv.appendChild(createHandPiece("black", p, i)));
  hands.white.forEach((p, i) => window.whiteHandDiv.appendChild(createHandPiece("white", p, i)));
};

// --- 移動実行 (executeMove) ---
window.executeMove = function(sel, x, y, doPromote) {
  history.push(deepCopyState());

  // ★★★ ここを追加（移動元を記録） ★★★
  if (sel.fromHand) {
      lastMoveFrom = null; // 持ち駒から打った場合はなし
  } else {
      lastMoveFrom = { x: sel.x, y: sel.y }; // 盤上の移動元を記録
  }
  // ★★★★★★★★★★★★★★★★★★★★★

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

const resignBtn = document.getElementById("resignBtn");

// ★ PvP用：個別の必殺技管理変数
let p1Skill = null;      // 先手の技オブジェクト
let p2Skill = null;      // 後手の技オブジェクト
let p1SkillCount = 0;    // 先手の使用回数
let p2SkillCount = 0;    // 後手の使用回数

// グローバル変数（main.jsと共通のものも、初期値設定のため記述）
let lastSkillKifu = "";
let pendingMove = null;
let hasShownEndEffect = false;
window.skillUsed = false;
window.isCaptureRestricted = false;

// 初期化処理
window.addEventListener("load", () => {
  cpuEnabled = false; // 対人戦なのでCPUはオフ
  bgm = document.getElementById("bgm");
  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  applyPlayerImage(); // 画像反映

  // ★★★ 必殺技の初期セットアップ ★★★
  const charBlackId = sessionStorage.getItem('char_black') || 'default';
  const charWhiteId = sessionStorage.getItem('char_white') || 'default';

  // --- 先手の技設定 ---
  if (charBlackId === 'default' && typeof CharItsumono !== 'undefined') p1Skill = CharItsumono.skill;
  else if (charBlackId === 'char_a' && typeof CharNekketsu !== 'undefined') p1Skill = CharNekketsu.skill;
  else if (charBlackId === 'char_b' && typeof CharReisei !== 'undefined') p1Skill = CharReisei.skill;
    
  // --- 後手の技設定 ---
  if (charWhiteId === 'default' && typeof CharItsumono !== 'undefined') p2Skill = CharItsumono.skill;
  else if (charWhiteId === 'char_a' && typeof CharNekketsu !== 'undefined') p2Skill = CharNekketsu.skill;
  else if (charWhiteId === 'char_b' && typeof CharReisei !== 'undefined') p2Skill = CharReisei.skill;
    
  // 初回の手番に合わせてグローバル変数を同期
  syncGlobalSkillState();

  // イベントリスナー
  if (resignBtn) resignBtn.addEventListener("click", resignGame);

  // ゲーム開始
  playBGM();
  startTimer();
  
  // ★render を呼ぶ
  render();
  
  if (typeof showKifu === "function") showKifu();

  const key = getPositionKey();
  positionHistory[key] = 1;
});

// ★★★ GameCore へのフック ★★★
// 駒の移動が終わった後に自動で呼ばれます。
// 対人戦では、手番が移った後に「スキルの切り替え」を行います。
window.onTurnComplete = function() {
    syncGlobalSkillState();
    updateSkillButton();
};

// ★★★ 手番ごとのスキル状態同期 ★★★
function syncGlobalSkillState() {
  if (turn === "black") {
    currentSkill = p1Skill;
    skillUseCount = p1SkillCount; 
    
    if (currentSkill) {
      const max = currentSkill.maxUses || 1;
      window.skillUsed = (skillUseCount >= max);
    } else {
      window.skillUsed = true;
    }
  } else {
    currentSkill = p2Skill;
    skillUseCount = p2SkillCount; 
    
    if (currentSkill) {
      const max = currentSkill.maxUses || 1;
      window.skillUsed = (skillUseCount >= max);
    } else {
      window.skillUsed = true;
    }
  }
  updateSkillButton();
}

// --- 以下、入力処理や固有UI ---

// 画像切り替え
function applyPlayerImage() {
  const blackHandBox = document.getElementById("blackHandBox");
  const charBlackId = sessionStorage.getItem('char_black') || 'default';
  if (blackHandBox) {
    const bgUrl = getImageUrlById(charBlackId);
    if (bgUrl) blackHandBox.style.backgroundImage = bgUrl;
  }

  const whiteHandBox = document.getElementById("whiteHandBox");
  const charWhiteId = sessionStorage.getItem('char_white') || 'default';
  if (whiteHandBox) {
    const bgUrl = getImageUrlById(charWhiteId);
    if (bgUrl) whiteHandBox.style.backgroundImage = bgUrl;
  }
}

function getImageUrlById(charId) {
  if (charId === 'char_a') return "url('script/image/char_a.png')";
  if (charId === 'char_b') return "url('script/image/char_b.png')";
  if (charId === 'default') return "url('script/image/karui_1p.PNG')";
  return null;
}

// BGM関連
function playBGM() {
  if (!bgm) return;
  bgm.volume = 0.3;
  bgm.play().catch(() => {
    document.addEventListener("click", () => {
      bgm.play().catch(e => {});
    }, { once: true });
  });
}

function stopBGM() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

// 待った機能
function undoMove() {
  if (typeof isSkillTargeting !== 'undefined' && isSkillTargeting) {
    isSkillTargeting = false;
    legalMoves = [];
    render();
    return;
  }

  if (history.length < 2 || gameOver) return;
  
  const prev = history[history.length - 2];
  history.length -= 2; 
  lastMoveFrom = null;
  restoreState(prev);

  window.isCaptureRestricted = false;
  gameOver = false;
  winner = null;
  statusDiv.textContent = "";
  checkStatusDiv.textContent = "";

  syncGlobalSkillState();
  render();
  if (typeof showKifu === "function") showKifu();
  startTimer();
}

// ★★★ 盤面クリック時の処理 ★★★
function onCellClick(x, y) {
  if (gameOver) return;

  // --- 必殺技発動モード ---
  if (typeof isSkillTargeting !== 'undefined' && isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      
      const result = currentSkill.execute(x, y);

      if (result === null) {
          legalMoves = currentSkill.getValidTargets();
          render();
          statusDiv.textContent = "移動させる場所を選んでください";
          return; 
      }

      // --- 完了処理 ---
      history.push(deepCopyState());
      const boardTable = document.getElementById("board");
      if (boardTable) boardTable.classList.remove("skill-targeting-mode");

      const endsTurn = (currentSkill.endsTurn !== false);

      if (endsTurn) {
          const kifuStr = result; 
          kifu.push(""); 
          kifu[kifu.length - 1] = kifuStr;
          moveCount++; 
          if (turn === "black") p1SkillCount++; else p2SkillCount++;
          turn = (turn === "black" ? "white" : "black");
      } 
      else {
          const movePart = result.split("：")[1] || result;
          lastSkillKifu = movePart; 
          if (turn === "black") p1SkillCount++; else p2SkillCount++;
          
          const max = currentSkill.maxUses || 1;
          const currentCount = (turn === "black") ? p1SkillCount : p2SkillCount;
          if (currentCount < max) statusDiv.textContent += " (必殺技完了！続けて指してください)";
      }
      
      lastMoveTo = null;
      if (moveSound) {
        moveSound.currentTime = 0;
        moveSound.play().catch(() => {});
      }

      if (currentSkill.reset) currentSkill.reset();
      isSkillTargeting = false;
      legalMoves = [];
      selected = null;
      
      syncGlobalSkillState();
      render();
      if (typeof showKifu === "function") showKifu();
      startTimer();
    }
    return;
  }
  
  // (通常移動)
  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;
    const isWhite = piece === piece.toLowerCase();
    if ((turn === "black" && isWhite) || (turn === "white" && !isWhite)) return;
    selected = { x, y, fromHand: false };
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

// 投了・スキルUI系
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
    winner = turn === "black" ? "white" : "black";
    saveGameResult(winner);
    render();
    if (typeof showKifu === "function") showKifu();
}

function closeResignModal() {
    const modal = document.getElementById("resignModal");
    if (modal) modal.style.display = "none";
}

function updateSkillButton() {
  const skillBtn = document.getElementById("skillBtn");
  if (!skillBtn) return;
  
  if (currentSkill) {
    skillBtn.style.display = "inline-block";
    skillBtn.textContent = currentSkill.name;

    if (currentSkill.buttonStyle) {
      Object.assign(skillBtn.style, currentSkill.buttonStyle);
    } else {
      skillBtn.style.backgroundColor = "#ff4500";
      skillBtn.style.color = "white";
      skillBtn.style.border = "none";
    }

    skillBtn.disabled = window.skillUsed; 
    skillBtn.style.opacity = window.skillUsed ? 0.5 : 1.0;
    
    if (window.skillUsed) {
        skillBtn.style.backgroundColor = "#ccc";
        skillBtn.style.border = "1px solid #999";
    }

  } else {
    skillBtn.style.display = "none";
  }
}

function toggleSkillMode() {
  if (gameOver) return;
  if (!currentSkill) return;
  if (isSkillTargeting) return;
  if (window.skillUsed) {
    alert("この対局では、必殺技はもう使えません。");
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

function resolvePromotion(doPromote) {
  const modal = document.getElementById("promoteModal");
  if (modal) modal.style.display = "none";
  if (pendingMove) {
    executeMove(pendingMove.sel, pendingMove.x, pendingMove.y, doPromote);
    pendingMove = null;
  }
}

// --- 棋譜表示の制御（ポップアップ化） ---
function toggleKifu() {
    const area = document.getElementById("kifuArea");
    if (area.style.display === "none") {
        area.style.display = "flex"; // 中央揃え
        const scrollBox = document.getElementById("kifu");
        if (scrollBox) {
            setTimeout(() => { scrollBox.scrollTop = scrollBox.scrollHeight; }, 50);
        }
    } else {
        area.style.display = "none";
    }
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

// --- メニュー開閉（既に存在する場合は上書き） ---
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

function saveGameResult(res) {
    const user = auth.currentUser;
    if (!user) return; 
    const opponentDisplayName = window.opponentName || "対人対局"; 
    
    // ログインユーザーを「先手」とみなし、先手が勝てばWIN、負ければLOSE
    let resultStatus = "DRAW";
    if (res === "black") resultStatus = "WIN";
    else if (res === "white") resultStatus = "LOSE";

    const gameRecord = {
        date: new Date(), 
        opponent: opponentDisplayName,
        moves: moveCount,
        result: resultStatus,
        mode: "offline_pvp", 
        kifuData: kifu 
    };

    db.collection("users").doc(user.uid).update({
        win: firebase.firestore.FieldValue.increment(resultStatus === "WIN" ? 1 : 0),
        lose: firebase.firestore.FieldValue.increment(resultStatus === "LOSE" ? 1 : 0),
        history: firebase.firestore.FieldValue.arrayUnion(gameRecord)
    }).then(() => {
        console.log("対人戦の記録を保存しました");
    });
}　

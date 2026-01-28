// script/main_player.js (PvP 初期安定版 + UI修正)

// DOM要素の参照
const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");

// ★★★ 手番消費なし必殺技の棋譜を一時保存する変数 ★★★
let lastSkillKifu = ""; 

// ★ PvP用：個別の必殺技管理変数
let p1Skill = null;      // 先手の技オブジェクト
let p2Skill = null;      // 後手の技オブジェクト
let p1SkillCount = 0;    // 先手の使用回数
let p2SkillCount = 0;    // 後手の使用回数
let pendingMove = null;  // 成り・不成の保留用変数

// ★UI用フラグ（追加）
let hasShownEndEffect = false;

// ★追加：必殺技を使用したかどうかのフラグ
window.skillUsed = false;
// ★追加：このターン、駒取りを禁止するかどうかのフラグ
window.isCaptureRestricted = false;

// 初期化処理
window.addEventListener("load", () => {
  cpuEnabled = false;
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
  render();
  if (typeof showKifu === "function") showKifu();

  const key = getPositionKey();
  positionHistory[key] = 1;
});

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

// ボタンの表示・スタイル更新関数
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

// ★★★ 1. 必殺技ボタンが押されたとき ★★★
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

// ★★★ 2. ポップアップで「発動」を選んだとき ★★★
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

// ★★★ 3. ポップアップで「やめる」を選んだとき ★★★
function closeSkillModal() {
  const modal = document.getElementById("skillModal");
  if (modal) modal.style.display = "none";
}

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
  if (isSkillTargeting) {
    isSkillTargeting = false;
    legalMoves = [];
    render();
    return;
  }

  if (history.length < 2 || gameOver) return;
  
  // ★元コードと同じ動き
  const prev = history[history.length - 2];
  history.length -= 2; 

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

// タイマー
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

// ★★★ 描画関数（UI修正版） ★★★
function render() {
  if (gameOver) {
    // 1. 勝敗メッセージの更新
    if (winner === "black") statusDiv.textContent = "先手の勝ちです！";
    else if (winner === "white") statusDiv.textContent = "後手の勝ちです！";
    else if (!winner) statusDiv.textContent = "引き分けです。";
    
    checkStatusDiv.textContent = "";

    // 2. 演出（1回だけ実行）
    if (!hasShownEndEffect && winner) {
        playSkillEffect("shori.PNG", "shori.mp3", null); // 勝利演出
        hasShownEndEffect = true; 
    }

    // 3. ホームに戻るボタンを表示（なければ作る）
    if (!document.getElementById("resetBtn")) {
       const btn = document.createElement("button");
       btn.id = "resetBtn";
       btn.textContent = "ホームに戻る"; 
       btn.style.padding = "10px 20px";
       btn.style.marginTop = "10px";
       btn.style.fontSize = "16px";
       btn.style.backgroundColor = "#d32f2f";
       btn.style.color = "white";
       btn.style.border = "none";
       btn.style.borderRadius = "5px";
       btn.style.cursor = "pointer";
       btn.onclick = () => { window.location.href = "home.html"; };
       
       statusDiv.appendChild(document.createElement("br"));
       statusDiv.appendChild(btn);
    }

  } else {
    // 通常時のステータス
    if (!isSkillTargeting) {
      let msg = "手番：" + (turn === "black" ? "先手" : "後手") + " / 手数：" + moveCount;
      if (window.isCaptureRestricted) msg += " 【攻撃禁止】";
      msg += (isKingInCheck(turn) ? "　王手！" : "");
      statusDiv.textContent = msg;
    }
    checkStatusDiv.textContent = "";
  }

  // 盤面描画
  board.innerHTML = "";
  for (let y = 0; y < 9; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < 9; x++) {
      const td = document.createElement("td");
      const piece = boardState[y][x];
      if (piece) {
        const isWhite = piece === piece.toLowerCase();
        const key = piece.startsWith("+") ? "+" + piece.replace("+","").toUpperCase() : piece.toUpperCase();
        td.textContent = pieceName[key];
        if (isWhite) td.style.transform = "rotate(180deg)";
        
        // スタイルの適用
        if (pieceStyles[y][x] === "green") {
          td.style.color = "#32CD32";
          td.style.fontWeight = "bold";
          td.style.textShadow = "1px 1px 0px #000";
        }
        
        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) td.classList.add("moved");
      }
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

// 持ち駒描画
function renderHands() {
  const order = ["P", "L", "N", "S", "G", "B", "R"];
  hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  blackHandDiv.innerHTML = "";
  whiteHandDiv.innerHTML = "";

  hands.black.forEach((p, i) => {
    const span = document.createElement("span");
    span.textContent = pieceName[p];
    if (selected && selected.fromHand && selected.player === "black" && selected.index === i) span.classList.add("selected");
    span.onclick = () => selectFromHand("black", i);
    blackHandDiv.appendChild(span);
  });

  hands.white.forEach((p, i) => {
    const span = document.createElement("span");
    span.textContent = pieceName[p];
    if (selected && selected.fromHand && selected.player === "white" && selected.index === i) span.classList.add("selected");
    span.onclick = () => selectFromHand("white", i);
    whiteHandDiv.appendChild(span);
  });
}

// ★★★ 盤面クリック時の処理 ★★★
function onCellClick(x, y) {
  if (gameOver) return;

  // --- 必殺技発動モード ---
  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      
      const result = currentSkill.execute(x, y);

      // nullなら待機
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
          
          // 制限チェック（表示用）
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

    // 駒取り禁止適用
    if (window.isCaptureRestricted) {
        legalMoves = legalMoves.filter(m => boardState[m.y][m.x] === "");
    }
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

// ① 変更後の movePieceWithSelected
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
      // ★ポップアップ表示
      pendingMove = { sel, x, y }; 
      const modal = document.getElementById("promoteModal");
      if (modal) {
          modal.style.display = "flex";
      } else {
          // 万が一HTMLがない場合は標準ダイアログ
          if(confirm("成りますか？")) executeMove(sel, x, y, true);
          else executeMove(sel, x, y, false);
      }
    }
  } else {
    executeMove(sel, x, y, false);
  }
}

// ② executeMove
function executeMove(sel, x, y, doPromote) {
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
        boardTable.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red", "flash-blue");
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

  // 棋譜
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
  
  if (typeof syncGlobalSkillState === "function") syncGlobalSkillState();
  if (typeof showKifu === "function") showKifu();

  render(); 

  if (!gameOver) startTimer();
  else stopTimer();
  moveCount++;

  // 終了判定
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    statusDiv.textContent = "500手に達したため、引き分けです。";
    render();
    return;
  }
  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";
    render();
    return;
  }
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();
  if (positionHistory[key] >= 4) {
    const records = repetitionHistory[key].slice(-4);
    const checking = records[0].checkingSide;
    gameOver = true;
    if (checking !== null) {
      winner = checking === "black" ? "white" : "black";
      statusDiv.textContent = "連続王手の千日手。王手をかけた側の負けです。";
    } else {
      winner = null;
      statusDiv.textContent = "千日手です。引き分け。";
    }
    render();
  }
}

// ★★★ 投了ボタンの処理（ポップアップ化） ★★★
function resignGame() {
  if (gameOver) return;
  
  // HTML側にあるはずの resignModal を使う
  const modal = document.getElementById("resignModal");
  if (modal) {
      modal.style.display = "flex";
  } else {
      // 万が一なければ confirm で代用
      if (confirm("投了しますか？")) executeResign();
  }
}

// 投了実行（HTMLボタンから呼ばれる想定）
function executeResign() {
    closeResignModal(); // ポップアップを閉じる
    gameOver = true;
    stopTimer();
    winner = turn === "black" ? "white" : "black";
    
    // 描画更新（これでrender()が呼ばれ、勝利演出やホームボタンが出る）
    render();
    if (typeof showKifu === "function") showKifu();
}

function closeResignModal() {
    const modal = document.getElementById("resignModal");
    if (modal) modal.style.display = "none";
}

// ★★★ 必殺技演出実行関数 ★★★
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
    } 
    else {
      const audio = document.getElementById("skillSound") || new Audio("script/audio/" + soundName);
      audio.src = "script/audio/" + soundName;
      audio.volume = 1.0;
      audio.play().catch(e => {});
    }
  }

  const boardTable = document.getElementById("board");
  if (boardTable && flashColor) {
    boardTable.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red");
    void boardTable.offsetWidth; 

    if (flashColor === "silver") boardTable.classList.add("flash-silver");
    else if (flashColor === "red") boardTable.classList.add("flash-red");
    else if (flashColor === "blue") boardTable.classList.add("flash-blue");
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
        area.style.display = "block";
        const scrollBox = area.querySelector("div[style*='overflow-y: auto']");
        if(scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
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
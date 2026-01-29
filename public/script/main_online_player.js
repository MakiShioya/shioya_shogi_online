// script/main_online_player.js (キャラクター同期 完全版)

// ★★★ 1. サーバー接続 ★★★
const socket = io();

// DOM要素の参照
const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");

// ★ 自分の選んだキャラIDを取得（なければデフォルト）
const myCharId = sessionStorage.getItem('my_character') || 'default';

// ★★★ 接続時、サーバーに「私はこのキャラです」と伝える ★★★
socket.on('connect', () => {
    console.log("サーバーに接続しました。キャラ情報を送信します:", myCharId);
    socket.emit('declare character', myCharId);
});

// 変数定義
let lastSkillKifu = ""; 
let p1Skill = null;      // 先手の技
let p2Skill = null;      // 後手の技
let p1SkillCount = 0;   
let p2SkillCount = 0;   
let pendingMove = null; 
let myRole = null;
let endReason = null;
let isGameStarted = false;
let hasShownEndEffect = false;
window.skillUsed = false;
window.isCaptureRestricted = false;

// 初期化処理
window.addEventListener("load", () => {
  cpuEnabled = false;
  bgm = document.getElementById("bgm");
  
  // ★★★ 追加：待機画面に自分のキャラ名を表示する処理 ★★★
  const myCharId = sessionStorage.getItem('my_character') || 'default';
  const charNameMap = {
      'default': 'キャラA', // ※あなたのゲームでの正しい名前に書き換えてください
      'char_a': 'キャラB',
      'char_b': 'キャラC'
  };
  const myCharName = charNameMap[myCharId] || "不明なキャラ";
  const displaySpan = document.getElementById("myCharNameDisplay");
  if (displaySpan) displaySpan.textContent = myCharName;

  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  // ★ここでは仮の初期化だけしておく（正しいキャラはgame startで設定される）
  initSkills('default', 'default'); 

  if (resignBtn) resignBtn.addEventListener("click", resignGame);

  playBGM();
  statusDiv.textContent = "対戦相手の入室を待っています..."; 
  render();

  if (typeof showKifu === "function") showKifu();

  const key = getPositionKey();
  positionHistory[key] = 1;
});

// ----------------------------------------------------
// ★★★ サーバーからの通信受信処理 ★★★
// ----------------------------------------------------

socket.on('role assigned', (role) => {
    myRole = role;
    let roleName = "観戦者";
    if (myRole === "black") roleName = "先手 (▲)";
    if (myRole === "white") roleName = "後手 (△)";
    
    statusDiv.textContent = `接続しました。待機中... （あなたは ${roleName} です）`;

    if (myRole === "white") {
        document.body.classList.add("view-white");
    } else {
        document.body.classList.remove("view-white");
    }
    updateHandLayout(myRole);
    render();
});

// ★★★ 修正：対局開始（キャラ情報付き） ★★★
socket.on('game start', (data) => {
    console.log("対局開始！キャラ情報を受信:", data);
    
    // 受信した正しいキャラIDでスキルを再設定
    if (data && data.blackCharId && data.whiteCharId) {
        initSkills(data.blackCharId, data.whiteCharId);
    }
    
    // 演出開始
    initGameSequence(); 
});

socket.on('shogi move', (data) => {
  executeMove(data.sel, data.x, data.y, data.promote, true);
});

socket.on('skill activate', (data) => {
  console.log("相手の必殺技を受信:", data);
  const skillToUse = (data.turn === "black") ? p1Skill : p2Skill;
  if (!skillToUse) return;

  currentSkill = skillToUse; 
  legalMoves = [{ x: data.x, y: data.y }];
  isSkillTargeting = true;

  const result = skillToUse.execute(data.x, data.y);

  if (data.isFinished) {
      processSkillAfterEffect(skillToUse, result, data.turn);
  } else {
      legalMoves = skillToUse.getValidTargets();
      render(); 
  }
});

socket.on('game resign', (data) => {
    const winColor = (data.loser === "black") ? "white" : "black";
    resolveResignation(winColor);
});

socket.on('game reset', () => {
  resetGame(); 
});


// ----------------------------------------------------
// ★★★ 関数エリア ★★★

// 開始演出
function initGameSequence() {
  // ★★★ 追加：待機画面を隠す処理 ★★★
    const overlay = document.getElementById("waitingOverlay");
    if (overlay) {
        overlay.style.opacity = "0"; // 透明にする
        setTimeout(() => {
            overlay.style.display = "none"; // 完全に消す
        }, 500);
    }

    const cutInImg = document.getElementById("skillCutIn");
    const isSente = (myRole !== "white");
    const imgPath = isSente ? "script/image/sente.PNG" : "script/image/gote.PNG";
    const audioPath = isSente ? "script/audio/sente.mp3" : "script/audio/gote.mp3";

    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play().catch(e => {});

    if (cutInImg) {
        cutInImg.src = imgPath;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth; 
        cutInImg.classList.add("cut-in-active");
    }

    setTimeout(() => {
        if (cutInImg) cutInImg.classList.remove("cut-in-active");
        startActualGame();
    }, 1000);
}

function startActualGame() {
    isGameStarted = true;
    statusDiv.textContent = "対局開始！";
    startTimer();
    render();
}

// ★★★ 修正：引数でIDを受け取って設定する形に変更 ★★★
function initSkills(blackId, whiteId) {
    // 画面表示用に一時保存（applyPlayerImageで使う）
    sessionStorage.setItem('online_black_char', blackId);
    sessionStorage.setItem('online_white_char', whiteId);

    // 先手のスキル設定
    if (blackId === 'default' && typeof CharItsumono !== 'undefined') p1Skill = CharItsumono.skill;
    else if (blackId === 'char_a' && typeof CharNekketsu !== 'undefined') p1Skill = CharNekketsu.skill;
    else if (blackId === 'char_b' && typeof CharReisei !== 'undefined') p1Skill = CharReisei.skill;

    // 後手のスキル設定
    if (whiteId === 'default' && typeof CharItsumono !== 'undefined') p2Skill = CharItsumono.skill;
    else if (whiteId === 'char_a' && typeof CharNekketsu !== 'undefined') p2Skill = CharNekketsu.skill;
    else if (whiteId === 'char_b' && typeof CharReisei !== 'undefined') p2Skill = CharReisei.skill;
  
    // 画像反映
    applyPlayerImage();
    syncGlobalSkillState();
}

function syncGlobalSkillState() {
  // 現在の手番に合わせて、使うスキルを切り替える
  if (turn === "black") {
    currentSkill = p1Skill;
    skillUseCount = p1SkillCount; 
  } else {
    currentSkill = p2Skill;
    skillUseCount = p2SkillCount; 
  }

  // 使用回数チェック
  if (currentSkill) {
      const max = currentSkill.maxUses || 1;
      window.skillUsed = (skillUseCount >= max);
  } else {
      window.skillUsed = true;
  }
  updateSkillButton();
}

function updateSkillButton() {
    const skillBtn = document.getElementById("skillBtn");
    if (!skillBtn) return;

    // 1. 「現在のターン」ではなく「自分の役割(myRole)」に基づいて表示するスキルを決める
    let mySkill = null;
    let myUseCount = 0;

    if (myRole === "black") {
        mySkill = p1Skill;
        myUseCount = p1SkillCount;
    } else if (myRole === "white") {
        mySkill = p2Skill;
        myUseCount = p2SkillCount;
    } else {
        // 観戦者などの場合はボタンを表示しない
        skillBtn.style.display = "none";
        return;
    }

    // 2. 自分のスキルが存在する場合のみボタンを表示・更新
    if (mySkill) {
        skillBtn.style.display = "inline-block";
        skillBtn.textContent = mySkill.name; // 常に自分の技名を表示

        // デザインの適用
        if (mySkill.buttonStyle) {
            Object.assign(skillBtn.style, mySkill.buttonStyle);
        } else {
            skillBtn.style.backgroundColor = "#ff4500";
            skillBtn.style.color = "white";
            skillBtn.style.border = "none";
        }

        // 3. 使用回数上限のチェック（自分の使用回数を見る）
        const max = mySkill.maxUses || 1;
        const isUsedUp = (myUseCount >= max);

        // 4. ボタンの有効/無効の切り替え
        // 「自分の番ではない」 または 「回数を使い切っている」 場合は押せないようにする
        if (turn !== myRole || isUsedUp) {
            skillBtn.disabled = true;
            skillBtn.style.opacity = 0.5;

            // 使い切った場合の色変更（オプション）
            if (isUsedUp) {
                skillBtn.style.backgroundColor = "#ccc";
                skillBtn.style.border = "1px solid #999";
            }
        } else {
            // 自分の番で、かつ使える状態
            skillBtn.disabled = false;
            skillBtn.style.opacity = 1.0;
        }

    } else {
        // スキルがないキャラの場合
        skillBtn.style.display = "none";
    }
}

function toggleSkillMode() {
  if (gameOver) return;
  if (myRole && turn !== myRole) return;
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

// ★★★ 修正：サーバーから送られてきたIDを使って画像を表示 ★★★
function applyPlayerImage() {
  const blackHandBox = document.getElementById("blackHandBox");
  // initSkills で保存したIDを使う
  const charBlackId = sessionStorage.getItem('online_black_char') || 'default';
  
  if (blackHandBox) {
    const bgUrl = getImageUrlById(charBlackId);
    if (bgUrl) blackHandBox.style.backgroundImage = bgUrl;
  }

  const whiteHandBox = document.getElementById("whiteHandBox");
  const charWhiteId = sessionStorage.getItem('online_white_char') || 'default';
  
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

// --- その他の共通関数（変更なし） ---

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
    if (!hasShownEndEffect && winner) {
        playGameEndEffect(winner);
        hasShownEndEffect = true; 
    }
    if (endReason) {
        statusDiv.textContent = endReason;
    } else {
        if (winner === "black") statusDiv.textContent = "先手の勝ちです！";
        else if (winner === "white") statusDiv.textContent = "後手の勝ちです！";
        else statusDiv.textContent = "引き分けです。";
    }
    checkStatusDiv.textContent = "";

    if (!document.getElementById("resetBtn")) {
       const btn = document.createElement("button");
       btn.id = "resetBtn";
       btn.textContent = "ホームに戻る"; 
       btn.style.padding = "10px 20px";
       btn.style.fontSize = "16px";
       btn.style.marginTop = "10px";
       btn.style.backgroundColor = "#d32f2f";
       btn.style.color = "white";
       btn.style.border = "none";
       btn.style.cursor = "pointer";
       btn.onclick = () => {
           if(confirm("ホーム画面に戻りますか？")) {
               window.location.href = "index.html"; 
           }
       };
       statusDiv.appendChild(document.createElement("br"));
       statusDiv.appendChild(btn);
    }

  } else {
    if (!isSkillTargeting) {
      let msg = "現在の手番：" + (turn === "black" ? "先手" : "後手") + " / 手数：" + moveCount;
      if (window.isCaptureRestricted) msg += " 【攻撃禁止中】";
      
      let roleText = "";
      if (myRole === "black") roleText = "（あなた：先手）";
      else if (myRole === "white") roleText = "（あなた：後手）";
      else if (myRole === "spectator") roleText = "（観戦中）";
      msg += " " + roleText;
      msg += (isKingInCheck(turn) ? "　王手！" : "");
      statusDiv.textContent = msg;
    }
    checkStatusDiv.textContent = "";
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
        td.textContent = pieceName[key];
        if (isWhite) td.style.transform = "rotate(180deg)";
        
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

function onCellClick(x, y) {
  if (!isGameStarted) return; 
  if (gameOver) return;
  if (myRole && turn !== myRole) return;

  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      const result = currentSkill.execute(x, y);

      if (socket) {
          socket.emit('skill activate', {
              x: x, y: y, turn: turn,
              isFinished: (result !== null) 
          });
      }

      if (result === null) {
          legalMoves = currentSkill.getValidTargets();
          render();
          statusDiv.textContent = "移動させる場所を選んでください";
          return; 
      }
      processSkillAfterEffect(currentSkill, result, turn);
    }
    return;
  }
  
  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;
    const isWhite = piece === piece.toLowerCase();
    if (turn === "black" && isWhite) return; 
    if (turn === "white" && !isWhite) return;
    selected = { x, y, fromHand: false };
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
  if (!isGameStarted) return; 
  if (gameOver) return;
  if (myRole && turn !== myRole) return;
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

function executeMove(sel, x, y, doPromote, fromNetwork = false) {
  history.push(deepCopyState());
  const pieceBefore = sel.fromHand ? hands[sel.player][sel.index] : boardState[sel.y][sel.x];
  const boardBefore = boardState.map(r => r.slice());
  const moveNumber = kifu.length + 1; 

  if (moveSound) {
    moveSound.currentTime = 0;
    moveSound.play().catch(() => {});
  }

  if (!fromNetwork) {
    socket.emit('shogi move', { sel, x, y, promote: doPromote });
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
        if (base === "R") boardTable.classList.add("flash-green");
        else if (base === "B") boardTable.classList.add("flash-orange");
        setTimeout(() => { if(boardTable) boardTable.className = ""; }, 2000);
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
  turn = turn === "black" ? "white" : "black";
  window.isCaptureRestricted = false;
  
  if (typeof syncGlobalSkillState === "function") syncGlobalSkillState();
  if (typeof showKifu === "function") showKifu();
  render(); 

  if (!gameOver) startTimer();
  else stopTimer();
  moveCount++;

  // 終了判定
  // 終了判定
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    statusDiv.textContent = "500手に達したため、引き分けです。";
    // 引き分けは保存しない、または "draw" として保存も可能（今回は何もしない）
    render();
    return;
  }

  // ★★★ 詰み判定（ここに保存処理を追加） ★★★
  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";

    // 観戦者ではなく、自分が対局者（black or white）の場合のみ保存を実行
    if (myRole === "black" || myRole === "white") {
        const result = (winner === myRole) ? "win" : "lose";
        saveGameResult(result);
    }

    render();
    return;
  }
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();
  if (positionHistory[key] >= 4) {
    gameOver = true;
    const records = repetitionHistory[key].slice(-4);
    if (records[0].checkingSide !== null) {
      winner = records[0].checkingSide === "black" ? "white" : "black";
      statusDiv.textContent = "連続王手の千日手。王手をかけた側の負けです。";
    } else {
      winner = null;
      statusDiv.textContent = "千日手です。引き分け。";
    }
    render();
  }
}

function processSkillAfterEffect(skillObj, result, playerColor) {
  history.push(deepCopyState());
  const boardTable = document.getElementById("board");
  if (boardTable) boardTable.classList.remove("skill-targeting-mode");

  const endsTurn = (skillObj.endsTurn !== false);
  if (endsTurn) {
      kifu.push(""); kifu[kifu.length - 1] = result;
      moveCount++; 
      if (playerColor === "black") p1SkillCount++; else p2SkillCount++;
      turn = (turn === "black" ? "white" : "black");
  } else {
      const movePart = result.split("：")[1] || result;
      lastSkillKifu = movePart; 
      if (playerColor === "black") p1SkillCount++; else p2SkillCount++;
  }
  
  lastMoveTo = null;
  if (moveSound) { moveSound.currentTime = 0; moveSound.play().catch(() => {}); }
  if (skillObj.reset) skillObj.reset();
  isSkillTargeting = false;
  legalMoves = [];
  selected = null;
  syncGlobalSkillState();
  render();
  if (typeof showKifu === "function") showKifu();
  startTimer();
}

// --- 修正：投了ボタンを押したときの処理 ---
function resignGame() {
    if (gameOver) return;
    if (myRole === "spectator") return; // 観戦者は投了不可
    
    // 今までの confirm(...) をやめて、自作ポップアップを表示
    const modal = document.getElementById("resignModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

// --- 追加：ポップアップで「投了する」を選んだときの処理 ---
function executeResign() {
    closeResignModal(); // まず箱を閉じる

    // 1. サーバーに「自分が負けた」と伝える
    if (socket) {
        socket.emit('game resign', { loser: myRole });
    }

    // 2. 自分の画面の処理を行う（自分が負けたので、勝者は相手）
    const winColor = (myRole === "black") ? "white" : "black";
    resolveResignation(winColor);
}

// --- 追加：ポップアップを閉じる処理 ---
function closeResignModal() {
    const modal = document.getElementById("resignModal");
    if (modal) {
        modal.style.display = "none";
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

function resetGame() {
  hasShownEndEffect = false; 
  turn = "black";
  gameOver = false;
  winner = null;
  moveCount = 0;
  kifu = [];
  history = []; 
  
  p1SkillCount = 0;
  p2SkillCount = 0;
  window.skillUsed = false;
  lastSkillKifu = "";
  
  boardState = [
    ["L", "N", "S", "G", "K", "G", "S", "N", "L"],
    ["", "R", "", "", "", "", "", "B", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P", "P"],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["p", "p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "b", "", "", "", "", "", "r", ""],
    ["l", "n", "s", "g", "k", "g", "s", "n", "l"]
  ];
  
  pieceStyles = Array(9).fill(null).map(() => Array(9).fill(null));
  hands = { black: [], white: [] };
  
  if (p1Skill && p1Skill.reset) p1Skill.reset();
  if (p2Skill && p2Skill.reset) p2Skill.reset();
  syncGlobalSkillState();

  statusDiv.textContent = "対局開始！";
  checkStatusDiv.textContent = "";
  
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.remove();

  render();
  startTimer();
  if (typeof showKifu === "function") showKifu();
  playBGM();
}

function resolveResignation(winnerColor) {
    gameOver = true;
    stopTimer();
    winner = winnerColor;
    const winnerName = (winner === "black") ? "先手" : "後手";
    endReason = "投了により、" + winnerName + "の勝ちです。";
    
    if (typeof showKifu === "function") showKifu();
    
    // 自分が対局者の場合のみ保存を実行
    if (myRole === "black" || myRole === "white") {
        const result = (winner === myRole) ? "win" : "lose";
        saveGameResult(result);
    }

    render();
}

function playGameEndEffect(winnerColor) {
    const cutInImg = document.getElementById("skillCutIn");
    let imgPath, audioPath;

    const iAmWinner = (winnerColor === myRole) || (myRole === "spectator" && winnerColor === "black");
    
    if (winnerColor === myRole) {
        imgPath = "script/image/shori.PNG";
        audioPath = "script/audio/shori.mp3";
    } else {
        imgPath = "script/image/haiboku.PNG";
        audioPath = "script/audio/haiboku.mp3";
    }

    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play().catch(e => {});

    if (cutInImg) {
        cutInImg.src = imgPath;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth; 
        cutInImg.classList.add("cut-in-active");
        setTimeout(() => { cutInImg.classList.remove("cut-in-active"); }, 3000);
    }
}


// --- 棋譜表示・コピー機能 ---

// 棋譜エリアの表示/非表示を切り替えるボタンの処理
function toggleKifu() {
    const area = document.getElementById("kifuArea");
    if (!area) return; // エラー回避

    if (area.style.display === "none" || area.style.display === "") {
        area.style.display = "block";
        // スクロールを一番下（最新の手）に合わせる
        const scrollBox = area.querySelector("div");
        if(scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
    } else {
        area.style.display = "none";
    }
}

// 棋譜をクリップボードにコピーする機能
function copyKifuText() {
    const kifuDiv = document.getElementById("kifu");
    if (kifuDiv) {
        navigator.clipboard.writeText(kifuDiv.innerText).then(() => {
            alert("棋譜をコピーしました！");
        }).catch(err => {
            console.error("コピーに失敗しました", err);
        });
    }
}


// --- 待ったボタンの処理（ポップアップ版） ---
function undoMove() {
    const modal = document.getElementById("undoModal");
    if (modal) {
        modal.style.display = "flex"; // ポップアップを表示
    } else {
        // 万が一HTMLがないときはアラートで代用
        alert("このキャラは「待った」スキルを持っていません。");
    }
}

// ポップアップを閉じる関数
function closeUndoModal() {
    const modal = document.getElementById("undoModal");
    if (modal) {
        modal.style.display = "none"; // 非表示にする
    }
}

/**
 * オンライン対戦の結果をFirestoreに保存する関数
 * @param {string} resultStatus - "win" または "lose"
 */
function saveGameResult(resultStatus) {
    const user = auth.currentUser;
    if (!user) {
        console.log("未ログインのため、オンライン対戦の記録は保存されません。");
        return; 
    }

    const opponentDisplayName = "オンライン対戦"; 
    const isWin = (resultStatus === "win");
    
    const gameRecord = {
        date: new Date(), 
        opponent: opponentDisplayName,
        moves: moveCount,
        result: isWin ? "WIN" : "LOSE",
        mode: "online",  
        kifuData: kifu // グローバルの棋譜配列
    };

    // Firestoreのユーザーデータを更新
    db.collection("users").doc(user.uid).update({
        win: firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
        lose: firebase.firestore.FieldValue.increment(isWin ? 0 : 1),
        history: firebase.firestore.FieldValue.arrayUnion(gameRecord)
    }).then(() => {
        console.log("オンライン対戦の記録（棋譜含む）を保存しました");
    }).catch((error) => {
        console.error("オンライン対戦の保存失敗:", error);
    });
}

// ★★★ 追加：DOM操作で駒台の左右を入れ替える関数 ★★★
function updateHandLayout(role) {
    // HTML内の左右のコンテナを取得
    const leftSide = document.querySelector(".side.left");
    const rightSide = document.querySelector(".side.right");
    
    // 駒台の要素を取得
    const blackBox = document.getElementById("blackHandBox");
    const whiteBox = document.getElementById("whiteHandBox");

    // 要素が見つからなければ何もしない（エラー回避）
    if (!leftSide || !rightSide || !blackBox || !whiteBox) return;

    if (role === "white") {
        // 【自分が後手の場合】
        // 通常は「左に後手台、右に先手台」だが、
        // 自分が下側に来るので「自分の台（後手）を右、相手の台（先手）を左」にしたい。

        // 1. 黒い箱（相手）を左サイドへ移動（prependで先頭＝上側に追加）
        leftSide.prepend(blackBox);

        // 2. 白い箱（自分）を右サイドへ移動（appendChildで末尾＝下側に追加）
        // ※右サイドには投了ボタンが上にあるため、その下に追加される
        rightSide.appendChild(whiteBox);

    } else {
        // 【自分が先手 または 観戦者の場合（デフォルト）】
        // 通常通りの配置に戻す

        // 1. 白い箱（相手）を左サイドへ（先頭）
        leftSide.prepend(whiteBox);

        // 2. 黒い箱（自分）を右サイドへ（末尾）
        rightSide.appendChild(blackBox);
    }
}

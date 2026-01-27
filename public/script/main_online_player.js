// main_online_player.js (Online PvP Final Version)

// ★★★ 1. サーバー接続 ★★★
const socket = io();

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

// ★ オンライン専用：自分の役割 ("black" / "white" / "spectator")
let myRole = null;

// 決着の理由（投了など）を保存する変数
let endReason = null; // 決着の理由（投了など）を保存する変数

// ★追加：対局が開始されたかどうかのフラグ（最初は false）
let isGameStarted = false;

// ★追加：決着時の演出を済ませたかどうかのフラグ
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

  applyPlayerImage(); 
  initSkills();       

  if (resignBtn) resignBtn.addEventListener("click", resignGame);

  playBGM();
  // startTimer();
  // render();

  statusDiv.textContent = "対戦相手の入室を待っています..."; // ★メッセージを変更
  render();


  if (typeof showKifu === "function") showKifu();

  const key = getPositionKey();
  positionHistory[key] = 1;
});

// ----------------------------------------------------
// ★★★ サーバーからの通信受信処理 ★★★
// ----------------------------------------------------

// 1. 役割（先手/後手）を受け取る
socket.on('role assigned', (role) => {
    myRole = role;
    let roleName = "観戦者";
    if (myRole === "black") roleName = "先手 (▲)";
    if (myRole === "white") roleName = "後手 (△)";
    
    console.log(`My Role: ${myRole}`);
    statusDiv.textContent += ` （あなたは ${roleName} です）`;

    if (myRole === "white") {
        document.body.classList.add("view-white");
    } else {
        document.body.classList.remove("view-white");
    }
    render();
});

// ★★★ 追加：対局開始の合図を受け取る ★★★
socket.on('game start', () => {
    console.log("対局開始の合図を受信しました");
    
    // これまでの処理をすべて削除し、演出用の関数を呼ぶだけにします
    initGameSequence(); 
});

// 2. 相手の指し手を受け取る
socket.on('shogi move', (data) => {
  console.log("相手の手を受信:", data);
  executeMove(data.sel, data.x, data.y, data.promote, true);
});

// 3. 相手の必殺技を受信したときの処理（2段階対応版）
socket.on('skill activate', (data) => {
  console.log("相手の必殺技を受信:", data);
  
  // 誰の技か特定
  const skillToUse = (data.turn === "black") ? p1Skill : p2Skill;
  if (!skillToUse) return;

  // 相手のスキルを「今の主役」にセット
  currentSkill = skillToUse; 
  
  // バリデーション突破
  legalMoves = [{ x: data.x, y: data.y }];
  isSkillTargeting = true;

  // 実行
  const result = skillToUse.execute(data.x, data.y);
  console.log("受信側での実行結果:", result);

  // 完了フラグを見て処理を分ける
  if (data.isFinished) {
      // 完了時の処理
      processSkillAfterEffect(skillToUse, result, data.turn);
  } else {
      // 途中経過の処理
      console.log("受信側：まだ続きがあります。次の入力を待ちます。");
      legalMoves = skillToUse.getValidTargets();
      render(); 
  }
});

// ★ 追加：相手が投了したときの処理
socket.on('game resign', (data) => {
    console.log("相手が投了しました");
    const winColor = (data.loser === "black") ? "white" : "black";
    resolveResignation(winColor);
});

// ★★★ 対局開始時の演出と処理（画像＋音声版） ★★★
function initGameSequence() {
    const cutInImg = document.getElementById("skillCutIn");
    
    // 自分の役割から「画像」と「音声」のパスを決定
    // ※観戦者(spectator)の場合は、とりあえず先手用を使う設定
    const isSente = (myRole !== "white");
    const imgPath = isSente ? "script/image/sente.PNG" : "script/image/gote.PNG";
    const audioPath = isSente ? "script/audio/sente.mp3" : "script/audio/gote.mp3";

    // 1. 音声を再生
    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play().catch(e => console.log("開始音声の再生に失敗:", e));

    // 2. 画像を表示（必殺技カットインを流用）
    if (cutInImg) {
        cutInImg.src = imgPath;
        // アニメーション再発火のおまじない
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth; 
        cutInImg.classList.add("cut-in-active");
    }

    // 3. 1秒待ってからゲーム本編開始
    setTimeout(() => {
        // 画像を消す
        if (cutInImg) cutInImg.classList.remove("cut-in-active");
        
        // ゲーム開始
        startActualGame();
    }, 1000);
}

// 演出が終わった後に呼ばれる、実際の開始処理
function startActualGame() {
    isGameStarted = true;        // 操作ロック解除
    statusDiv.textContent = "対局開始！";
    
    // ここで初めてタイマーを動かす
    startTimer();
    render();
}

// 演出が終わった後に呼ばれる、実際の開始処理
function startActualGame() {
    isGameStarted = true;        // 操作ロック解除
    statusDiv.textContent = "対局開始！";
    
    // ここで初めてタイマーを動かす
    startTimer();
    render();
}

// 4. ゲームリセット命令を受信
socket.on('game reset', () => {
  console.log("ゲームリセットを実行します");
  resetGame(); 
});



// ----------------------------------------------------

function initSkills() {
  const charBlackId = sessionStorage.getItem('char_black') || 'default';
  const charWhiteId = sessionStorage.getItem('char_white') || 'default';

  if (charBlackId === 'default' && typeof CharItsumono !== 'undefined') p1Skill = CharItsumono.skill;
  else if (charBlackId === 'char_a' && typeof CharNekketsu !== 'undefined') p1Skill = CharNekketsu.skill;
  else if (charBlackId === 'char_b' && typeof CharReisei !== 'undefined') p1Skill = CharReisei.skill;

  if (charWhiteId === 'default' && typeof CharItsumono !== 'undefined') p2Skill = CharItsumono.skill;
  else if (charWhiteId === 'char_a' && typeof CharNekketsu !== 'undefined') p2Skill = CharNekketsu.skill;
  else if (charWhiteId === 'char_b' && typeof CharReisei !== 'undefined') p2Skill = CharReisei.skill;
  
  syncGlobalSkillState();
}

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

    if (myRole && turn !== myRole) {
        skillBtn.disabled = true;
        skillBtn.style.opacity = 0.5;
        return;
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
  
  if (myRole && turn !== myRole) {
      return;
  }

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
  if (modal) {
      modal.style.display = "flex";
  }
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
  legalMoves = currentSkill.getValidTargets();

  const boardTable = document.getElementById("board");
  if (boardTable) {
      boardTable.classList.add("skill-targeting-mode");
  }
  
  render();
  statusDiv.textContent = `必殺技【${currentSkill.name}】：発動するマスを選んでください`;
}

function closeSkillModal() {
  const modal = document.getElementById("skillModal");
  if (modal) {
      modal.style.display = "none";
  }
}

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

function undoMove() {
  // オンライン対戦では「待った」を制限
  alert("このキャラは「待った」スキルを持っていません。");
  return; 

  /* 以下は機能として残しておく
  if (isSkillTargeting) {
    isSkillTargeting = false;
    legalMoves = [];
    render();
    return;
  }
  if (history.length < 2 || gameOver) return;
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
  */
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

// ★★★ 修正版 render関数 ★★★
function render() {
  if (gameOver) {
    if (!hasShownEndEffect && winner) {
        playGameEndEffect(winner);
        hasShownEndEffect = true; // 1回だけ実行するようにする
    }
    if (endReason) {
        statusDiv.textContent = endReason;
    } else {
        if (winner === "black") statusDiv.textContent = "先手の勝ちです！";
        else if (winner === "white") statusDiv.textContent = "後手の勝ちです！";
        else statusDiv.textContent = "千日手です。引き分け。";
    }
    checkStatusDiv.textContent = "";

    // ★ リセットボタンの表示処理
   if (!document.getElementById("resetBtn")) {
       const btn = document.createElement("button");
       btn.id = "resetBtn";
       btn.textContent = "ホームに戻る"; // 【変更1】文字を変更
       btn.style.padding = "10px 20px";
       btn.style.fontSize = "16px";
       btn.style.marginTop = "10px";
       btn.style.backgroundColor = "#d32f2f"; // 【任意】ホームに戻るっぽく赤色に変更してもOK
       btn.style.color = "white";
       btn.style.border = "none";
       btn.style.cursor = "pointer";
       
       // 【変更2】クリック時の動作をページ移動に変更
       btn.onclick = () => {
           // 確認メッセージを出さずに即移動でよければ if文を外してもOK
           if(confirm("ホーム画面に戻りますか？")) {
               window.location.href = "index.html"; 
           }
       };
       
       statusDiv.appendChild(document.createElement("br"));
       statusDiv.appendChild(btn);
   }

  } else {
    // ゲーム中の表示
    if (!isSkillTargeting) {
      let msg = "現在の手番：" + (turn === "black" ? "先手" : "後手") + " / 手数：" + moveCount;
      if (window.isCaptureRestricted) {
          msg += " 【攻撃禁止中】";
      }
      
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

// ★★★ onCellClick（途中経過も送信する版） ★★★
function onCellClick(x, y) {
  if (!isGameStarted) return; // ★追加：まだ始まってなければ何もしない
  if (gameOver) return;
  if (myRole && turn !== myRole) return;

  // --- 必殺技発動モード ---
  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      
      // 1. 技を実行
      const result = currentSkill.execute(x, y);

      // 結果がnullでも成功でも、とにかくクリック情報を送る
      if (socket) {
          socket.emit('skill activate', {
              x: x,
              y: y,
              turn: turn,
              isFinished: (result !== null) 
          });
      }

      // 2. 途中経過（1段階目）の場合
      if (result === null) {
          console.log("👆 必殺技の1段階目（選択）を実行しました");
          legalMoves = currentSkill.getValidTargets();
          render();
          statusDiv.textContent = "移動させる場所を選んでください";
          return; 
      }

      // 3. 完了（2段階目）の場合 -> 共通処理へ
      console.log("🚀 必殺技完了！処理を進めます");
      processSkillAfterEffect(currentSkill, result, turn);
    }
    return;
  }
  
  // --- 通常の移動処理 ---
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
  if (!isGameStarted) return; // ★追加：まだ始まってなければ何もしない
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

// script/main_online_player.js の executeMove をこれに書き換え

function executeMove(sel, x, y, doPromote, fromNetwork = false) {
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

  if (!fromNetwork) {
    socket.emit('shogi move', {
      sel: sel,
      x: x,
      y: y,
      promote: doPromote
    });
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

  // ★1. まず通常の描画を行う
  render(); 

  if (!gameOver) startTimer();
  else stopTimer();

  moveCount++;

  // --- 終了判定エリア ---

  // 1. 手数制限
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    statusDiv.textContent = "500手に達したため、引き分けです。";
    if (typeof showKifu === "function") showKifu();
    render(); // ★追加：終了画面を表示！
    return;
  }

  // 2. 詰み判定
  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";
    if (typeof showKifu === "function") showKifu();
    render(); // ★追加：終了画面（再戦ボタン）を表示！
    return;
  }

  // 3. 千日手判定
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();
  if (positionHistory[key] >= 4) {
    const records = repetitionHistory[key].slice(-4);
    const allCheck = records.every(r => r.isCheck);
    const sameSide = records.every(r => r.checkingSide === records[0].checkingSide);
    
    gameOver = true;
    if (allCheck && sameSide && records[0].checkingSide !== null) {
      winner = records[0].checkingSide === "black" ? "white" : "black";
      statusDiv.textContent = "連続王手の千日手です。王手をかけ続けた側の負けです。";
    } else {
      winner = null;
      statusDiv.textContent = "千日手です。引き分け。";
    }
    if (typeof showKifu === "function") showKifu();
    render(); // ★追加：終了画面を表示！
  }
}


// 共通処理関数
function processSkillAfterEffect(skillObj, result, playerColor) {
  history.push(deepCopyState());
  
  const boardTable = document.getElementById("board");
  if (boardTable) boardTable.classList.remove("skill-targeting-mode");

  const endsTurn = (skillObj.endsTurn !== false);

  if (endsTurn) {
      const kifuStr = result; 
      kifu.push(""); 
      kifu[kifu.length - 1] = kifuStr;
      
      moveCount++; 
      if (playerColor === "black") p1SkillCount++; else p2SkillCount++;
      turn = (turn === "black" ? "white" : "black");
  } 
  else {
      const movePart = result.split("：")[1] || result;
      lastSkillKifu = movePart; 
      
      if (playerColor === "black") p1SkillCount++; else p2SkillCount++;

      const max = skillObj.maxUses || 1;
      const currentCount = (playerColor === "black") ? p1SkillCount : p2SkillCount;
      
      if (!window.skillUsed && currentCount < max) { 
         // メッセージ追記等は適宜
      }
  }
  
  lastMoveTo = null;
  if (moveSound) {
    moveSound.currentTime = 0;
    moveSound.play().catch(() => {});
  }

  if (skillObj.reset) skillObj.reset();
  isSkillTargeting = false;
  legalMoves = [];
  selected = null;

  syncGlobalSkillState();

  render();
  if (typeof showKifu === "function") showKifu();
  
  startTimer();
}

// ★ 修正：投了処理
function resignGame() {
    if (gameOver) return;
    if (myRole === "spectator") return; // 観戦者は投了不可
    
    if (!confirm("本当に投了しますか？")) return;

    // 1. サーバーに「自分が負けた」と伝える
    socket.emit('game resign', { loser: myRole });

    // 2. 自分の画面の処理を行う（自分が負けたので、勝者は相手）
    const winColor = (myRole === "black") ? "white" : "black";
    resolveResignation(winColor);
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
        a.play().catch(e => console.log("再生エラー: " + name));
      });
    } 
    else {
      const audio = document.getElementById("skillSound");
      if (audio) {
        audio.src = "script/audio/" + soundName;
        audio.volume = 1.0;
        audio.play().catch(e => console.log("再生エラー: " + soundName));
      }
    }
  }

  const boardTable = document.getElementById("board");
  if (boardTable && flashColor) {
    boardTable.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red", "flash-blue");
    void boardTable.offsetWidth; 

    if (flashColor === "silver") {
      boardTable.classList.add("flash-silver");
    } else if (flashColor === "red") {
      boardTable.classList.add("flash-red");
    } else if (flashColor === "blue") {
      boardTable.classList.add("flash-blue");
    }
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

// ★★★ ゲームリセット実行関数 ★★★
function resetGame() {

  // 既存のフラグ初期化エリアに以下を追加
  hasShownEndEffect = false; 

  // 1. 各種フラグのリセット
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
  
  // 2. 盤面の初期化
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
  
  // スタイル・持ち駒クリア
  pieceStyles = Array(9).fill(null).map(() => Array(9).fill(null));
  hands = { black: [], white: [] };
  
  // スキル状態リセット
  if (p1Skill && p1Skill.reset) p1Skill.reset();
  if (p2Skill && p2Skill.reset) p2Skill.reset();
  syncGlobalSkillState();

  // 表示更新
  statusDiv.textContent = "対局開始！";
  checkStatusDiv.textContent = "";
  
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.remove();

  render();
  startTimer();
  if (typeof showKifu === "function") showKifu();
  playBGM();
}

// ★ 追加：投了時の共通処理（自分も相手もこれを使う）
function resolveResignation(winnerColor) {
    gameOver = true;
    stopTimer();
    winner = winnerColor;
    
    // 決着理由をセット（render関数で表示される）
    const winnerName = (winner === "black") ? "先手" : "後手";
    endReason = "投了により、" + winnerName + "の勝ちです。";

    // 棋譜があれば出力
    if (typeof showKifu === "function") showKifu();

    // ★重要：画面を再描画して、メッセージとホームボタンを表示させる
    render();
}

// ★★★ 決着時の演出関数 ★★★
function playGameEndEffect(winnerColor) {
    const cutInImg = document.getElementById("skillCutIn");
    let imgPath, audioPath;

    // 勝ち負け判定（自分が勝ったか、相手が勝ったか）
    // ※観戦者の場合はとりあえず勝者視点の画像を出します
    const iAmWinner = (winnerColor === myRole) || (myRole === "spectator" && winnerColor === "black"); // 観戦者は便宜上
    
    // 自分が勝った場合
    if (winnerColor === myRole) {
        imgPath = "script/image/shori.PNG";
        audioPath = "script/audio/shori.mp3";
    } 
    // 自分が負けた場合（相手が勝った場合）
    else {
        imgPath = "script/image/haiboku.PNG";
        audioPath = "script/audio/haiboku.mp3";
    }

    // もし引き分け(winner === null)の場合は演出なしならここで return

    // 1. 音声再生
    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play().catch(e => console.log("決着音声の再生に失敗:", e));

    // 2. 画像表示
    if (cutInImg) {
        cutInImg.src = imgPath;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth; 
        cutInImg.classList.add("cut-in-active");

        // 3秒後に画像だけ消す（結果画面が見えるように）
        setTimeout(() => {
            cutInImg.classList.remove("cut-in-active");
        }, 3000);
    }
}

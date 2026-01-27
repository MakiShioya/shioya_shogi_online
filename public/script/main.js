// script/main.js (CPU vs Player)

// DOM要素の参照
const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");

// ★★★ 手番消費なし必殺技の棋譜を一時保存する変数 ★★★
let lastSkillKifu = "";
// ★★★ 成り・不成の保留用変数 ★★★
let pendingMove = null;

// ★追加：必殺技を使用したかどうかのフラグ（衝突防止のためwindowプロパティにする）
window.skillUsed = false;
// ★追加：このターン、駒取りを禁止するかどうかのフラグ
window.isCaptureRestricted = false;

// 初期化処理
window.addEventListener("load", () => {
  bgm = document.getElementById("bgm");
  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  applyPlayerImage();

  if (resignBtn) {
    resignBtn.addEventListener("click", resignGame);
  }

  const charId = sessionStorage.getItem('char_black') || 'default';
  
  if (charId === 'default' && typeof CharItsumono !== 'undefined') {
    currentSkill = CharItsumono.skill;
  } else if (charId === 'char_a' && typeof CharNekketsu !== 'undefined') {
    currentSkill = CharNekketsu.skill;
  } else if (charId === 'char_b' && typeof CharReisei !== 'undefined') {
    currentSkill = CharReisei.skill;
  } else {
    currentSkill = null;
  }

  updateSkillButton();

  playBGM();
  startTimer();
  
  render();
  if (typeof showKifu === "function") {
    showKifu();
  }

  const key = getPositionKey();
  positionHistory[key] = 1;
});

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
  const blackHandBox = document.getElementById("blackHandBox");
  if (!blackHandBox) return;

  const charId = sessionStorage.getItem('char_black') || 'default';
  let imageUrl = "";
  
  if (charId === 'default') imageUrl = "url('script/image/karui_1p.PNG')";
  else if (charId === 'char_a') imageUrl = "url('script/image/char_a.png')";
  else if (charId === 'char_b') imageUrl = "url('script/image/char_b.png')";

  if (imageUrl) blackHandBox.style.backgroundImage = imageUrl;
}

function undoMove() {
  if (typeof isThinking !== 'undefined' && isThinking) return;
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

  // Undoしたら制限もリセット
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
  if (timerBox) {
    timerBox.textContent = "考慮時間: " + currentSeconds + "秒";
  }
}

function render() {
  if (gameOver) {
    if (winner === "black") statusDiv.textContent = "先手の勝ちです！";
    else if (winner === "white") statusDiv.textContent = "後手の勝ちです！";
    else statusDiv.textContent = "千日手です。引き分け。";
    checkStatusDiv.textContent = "";
  } else {
    if (!isSkillTargeting) {
      // 駒取り禁止中の場合、メッセージを表示すると親切
      let msg = "現在の手番：" + (turn === "black" ? "先手" : "後手") + " / 手数：" + moveCount;
      if (window.isCaptureRestricted) {
          msg += " 【攻撃禁止中】";
      }
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
        } else if (pieceStyles[y][x] === "blue") {
          td.style.color = "#1E90FF";
          td.style.fontWeight = "bold";
          td.style.textShadow = "1px 1px 0px #000";
        }

        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) {
          td.classList.add("moved");
        }
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
  if (gameOver) return;

  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      
      const result = currentSkill.execute(x, y);

      if (result === null) {
          legalMoves = currentSkill.getValidTargets();
          render();
          statusDiv.textContent = "移動させる場所を選んでください";
          return; 
      }

      history.push(deepCopyState());

      const boardTable = document.getElementById("board");
      if (boardTable) boardTable.classList.remove("skill-targeting-mode");

      const endsTurn = (currentSkill.endsTurn !== false);

      // 必殺技成功時はフラグを立てる
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
      if (moveSound) {
        moveSound.currentTime = 0;
        moveSound.play().catch(() => {});
      }

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

  if (cpuEnabled && turn === cpuSide) return;

  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;
    const isWhite = piece === piece.toLowerCase();
    if ((turn === "black" && isWhite) || (turn === "white" && !isWhite)) return;
    selected = { x, y, fromHand: false };
    legalMoves = getLegalMoves(x, y);
    
    // ★★★ ここで「駒取り禁止」を適用 ★★★
    if (window.isCaptureRestricted) {
        // 移動先（m.x, m.y）に駒がある手（＝相手の駒を取る手）を除外する
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

// 駒を動かす（チェックとポップアップのみ）
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
    
    // CPUはポップアップなし
    if (cpuEnabled && turn === cpuSide) {
      executeMove(sel, x, y, true); // CPUは常に成る
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

// 実際の移動処理
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
  if (lastSkillKifu !== "") {
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

  turn = turn === "black" ? "white" : "black";

  // ★★★ 手番交代のタイミングで、攻撃禁止フラグを解除 ★★★
  window.isCaptureRestricted = false;

  if (typeof showKifu === "function") showKifu();

  // 画面更新
  render();

  if (!gameOver) startTimer();
  else stopTimer();

  moveCount++;

  // CPU思考開始
  if (!isSimulating && cpuEnabled && turn === cpuSide && !gameOver) {
    setTimeout(() => cpuMove(), 1000);
  }

  // 終了判定
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    statusDiv.textContent = "500手に達したため、引き分けです。";
    if (typeof showKifu === "function") showKifu();
    render(); return;
  }
  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";
    if (typeof showKifu === "function") showKifu();
    render(); return;
  }
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();
  if (positionHistory[key] >= 4) {
    gameOver = true;
    statusDiv.textContent = "千日手です。引き分け。";
    if (typeof showKifu === "function") showKifu();
    render();
  }
}

function resignGame() {
  if (gameOver) return;
  if (!confirm("投了しますか？")) return;
  gameOver = true;
  stopTimer();
  winner = turn === "black" ? "white" : "black";
  statusDiv.textContent = "投了により、" + (winner === "black" ? "先手" : "後手") + "の勝ちです。";
  checkStatusDiv.textContent = "";
  if (typeof showKifu === "function") showKifu();
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

// ★★★ 2. ポップアップで「発動」を選んだとき（修正版） ★★★
function confirmSkillActivate() {
  // ポップアップを閉じる
  closeSkillModal();
  
  // スキル状態をリセット（念のため）
  if (currentSkill.reset) currentSkill.reset();
  selected = null;
  
  // ★重要：モードに入る前に、ターゲットを取得してみる
  const targets = currentSkill.getValidTargets();

  // ★安全装置：もし候補が1つもなければ、アラートを出して強制キャンセル！
  // これにより、何も選べずにゲームが進行不能になるのを防ぎます
  if (!targets || targets.length === 0) {
      alert("この必殺技で動かせる有効な場所がありません。\n（王手放置になる、または動かせる駒がないなど）");
      
      // 必殺技モードに入らずに終了
      isSkillTargeting = false;
      return; 
  }

  // 候補がある場合のみ、モード移行して続行
  isSkillTargeting = true;
  legalMoves = targets; // 取得済みのターゲットをセット

  // 盤面をライトグリーンにする
  const boardTable = document.getElementById("board");
  if (boardTable) {
      boardTable.classList.add("skill-targeting-mode");
  }
  
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
    } else {
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
    if (flashColor) boardTable.classList.add("flash-" + flashColor);
  }
}

// ポップアップのボタンから呼ばれる関数
function resolvePromotion(doPromote) {
  const modal = document.getElementById("promoteModal");
  if (modal) modal.style.display = "none";

  if (pendingMove) {
    executeMove(pendingMove.sel, pendingMove.x, pendingMove.y, doPromote);
    pendingMove = null;
  }
}

// ★★★ 棋譜エリアの表示/非表示を切り替える ★★★
function toggleKifu() {
    const area = document.getElementById("kifuArea");
    if (area.style.display === "none") {
        area.style.display = "block";
        // 表示した瞬間に一番下（最新の手）までスクロール
        const scrollBox = area.querySelector("div[style*='overflow-y: auto']");
        if(scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
    } else {
        area.style.display = "none";
    }
}

// ★★★ 棋譜テキストをコピーする（div対応版） ★★★
function copyKifuText() {
    const kifuDiv = document.getElementById("kifu");
    if (kifuDiv) {
        navigator.clipboard.writeText(kifuDiv.innerText).then(() => {
            alert("棋譜をコピーしました！");
        });
    }
}
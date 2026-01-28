// script/yaneuraou_main.js
// やねうら王専用メインスクリプト（グラフ機能強化・修正版）

// --- ★やねうら王用 設定変数 ---
let usiHistory = []; // 棋譜（USI形式）を記録する配列
let isEngineReady = false; // エンジンの準備ができているか
let evalHistory = [0]; // 評価値の履歴（初期値0）
let evalChart = null;  // グラフのインスタンス
let isPondering = false; // 先読み中かどうか
let ponderTimer = null;  // 休憩用のタイマー
let isStoppingPonder = false;// Ponder停止中かどうかのフラグ
let hasShownEndEffect = false;
// ★追加：必殺技を使用したかどうかのフラグ
window.skillUsed = false;
// ★追加：このターン、駒取りを禁止するかどうかのフラグ
window.isCaptureRestricted = false;
// -----------------------------

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
});

function sendToEngine(msg) {
    if (typeof engineWorker !== 'undefined' && engineWorker) {
        engineWorker.postMessage(msg);
    } else {
        console.error("Workerが見つかりません:", msg);
    }
}

function handleEngineMessage(msg) {
    // console.log("Engine says:", msg); // ログが多い場合はコメントアウト

    // ★評価値解析（修正版：上書き更新型）
    if (typeof msg === "string" && msg.includes("info") && msg.includes("score cp")) {
        const parts = msg.split(" ");
        const scoreIdx = parts.indexOf("cp") + 1;
        let score = parseInt(parts[scoreIdx]);

        if (turn === "white") {
            score = -score;
        }
        
        // 現在の手数位置の評価値を更新（pushではなく代入）
        evalHistory[moveCount] = score;
        
        // 過去の欠損（undefined）があれば埋める
        for(let i = 0; i < moveCount; i++) {
            if (evalHistory[i] === undefined) evalHistory[i] = evalHistory[i-1] || 0;
        }
        
        // グラフを更新（引数なしで呼ぶ）
        updateChart();
    }

    if (msg === "usiok") {
        console.log("USI OK! -> isready");
        sendToEngine("isready");
    }
    else if (msg === "readyok") {
        isEngineReady = true;
        statusDiv.textContent = "対局開始！";
        console.log("Ready OK!");
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
            
            if (!gameOver) {
                setTimeout(startPondering, 500); 
            }
        }
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

  // 評価値履歴も戻す
  if (evalHistory.length > 2) {
      evalHistory.length -= 2;
      updateChart(); // グラフ反映
  }

  if (usiHistory.length >= 2) {
      usiHistory.length -= 2;
  }

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
    // 1. 勝敗メッセージ
    if (winner === "black") statusDiv.textContent = "あなたの勝ちです！";
    else if (winner === "white") statusDiv.textContent = "AI（試験実装）の勝ちです！";
    else statusDiv.textContent = "引き分けです。";
    checkStatusDiv.textContent = "";

    // 2. 演出（1回のみ）
    if (!hasShownEndEffect) {
        if (winner === "black") {
            playSkillEffect("shori.PNG", "shori.mp3", null);
        } else if (winner === "white") {
            // 負け演出（もし画像があれば shori.PNG の代わりに指定してください）
            playSkillEffect("haiboku.PNG", "haiboku.mp3", null);
        }
        hasShownEndEffect = true; 
    }

    // 3. ホームに戻るボタン
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
    // 進行中の表示（既存の駒取り禁止メッセージなどはそのまま）
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

  // --- 必殺技発動モード ---
  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      
      if (typeof stopPondering === "function") stopPondering();

      const result = currentSkill.execute(x, y);

      if (result === null) {
          legalMoves = currentSkill.getValidTargets();
          render();
          statusDiv.textContent = "移動させる場所を選んでください";
          return; 
      }

      history.push(deepCopyState());

      const boardTable = document.getElementById("board");
      if (boardTable) {
          boardTable.classList.remove("skill-targeting-mode");
      }

      const endsTurn = (currentSkill.endsTurn !== false);

      // 必殺技成功時はフラグを立てる
      window.skillUsed = true; 
      skillUseCount++;

      if (endsTurn) {
          const kifuStr = result; 
          kifu.push(""); 
          kifu[kifu.length - 1] = kifuStr;
          
          moveCount++;
      } 
      else {
          const movePart = result.split("：")[1] || result;
          lastSkillKifu = movePart;
      }
      
      lastMoveTo = null;
      if (moveSound) {
        moveSound.currentTime = 0;
        moveSound.play().catch(() => {});
      }

      // 必殺技後はUSI履歴をリセットしてSFEN送信
      usiHistory = []; 
      if (endsTurn) {
          turn = (turn === "black" ? "white" : "black");
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
  // ----------------------------------------

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

// 実際の移動処理（USI記録・AI思考トリガー含む）
function executeMove(sel, x, y, doPromote) {
  if (typeof stopPondering === "function") stopPondering();

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

  // ★USI履歴への記録
  const usiMove = convertToUsi(sel, x, y, doPromote, pieceBefore);
  usiHistory.push(usiMove);

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

  turn = turn === "black" ? "white" : "black";

  // ★★★ 手番交代のタイミングで、攻撃禁止フラグを解除 ★★★
  window.isCaptureRestricted = false;

  if (typeof showKifu === "function") showKifu();

  render();

  if (!gameOver) startTimer();
  else stopTimer();

  moveCount++;

  // ★CPU思考開始（1秒後）
  if (turn === cpuSide && !gameOver) {
    setTimeout(() => cpuMove(), 1000);
  }

  checkGameOver();
}

function checkGameOver() {
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    statusDiv.textContent = "500手に達したため、引き分けです。";
    saveGameResult(null); // ★追加：引き分けとして保存
    if (typeof showKifu === "function") showKifu();
    render(); return;
  }
  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";
    saveGameResult(winner); // ★追加：詰みによる勝敗を保存
    if (typeof showKifu === "function") showKifu();
    render(); return;
  }
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();
  if (positionHistory[key] >= 4) {
    gameOver = true;
    statusDiv.textContent = "千日手です。引き分け。";
    saveGameResult(null); // ★追加shori
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

// 必殺技ボタン
function toggleSkillMode() {
  if (gameOver) return;
  if (!currentSkill) return;
  if (isSkillTargeting) return;
  if (skillUsed) {
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

// ★★★ 2. ポップアップで「発動」を選んだとき（安全装置付き） ★★★
function confirmSkillActivate() {
  closeSkillModal();
  
  if (currentSkill.reset) currentSkill.reset();
  selected = null;
  
  const targets = currentSkill.getValidTargets();

  // ★安全装置
  if (!targets || targets.length === 0) {
      alert("この必殺技で動かせる有効な場所がありません。\n（王手放置になる、または動かせる駒がないなど）");
      isSkillTargeting = false;
      return; 
  }

  isSkillTargeting = true;
  legalMoves = targets; 

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
    skillBtn.disabled = skillUsed; 
    skillBtn.style.opacity = skillUsed ? 0.5 : 1.0;
    if (skillUsed) {
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
    // 必殺技後や履歴なしの場合はSFEN
    if ((typeof skillUsed !== 'undefined' && skillUsed) || usiHistory.length === 0) {
        const sfen = generateSfen();
        positionCmd = "position sfen " + sfen;
    } 
    else {
        positionCmd = "position startpos moves " + usiHistory.join(" ");
    }

    sendToEngine(positionCmd);

    let thinkTime = (moveCount > 20) ? 10000 : 3000;
    console.log(`手数(usiHistory): ${usiHistory.length}, 思考時間: ${thinkTime}ms`);
    sendToEngine("go byoyomi " + thinkTime);
}

function convertToUsi(sel, toX, toY, promoted, pieceName) {
    const fileTo = 9 - toX;
    const rankTo = String.fromCharCode(97 + toY);

    if (sel.fromHand) {
        // pieceName引数（pieceBefore）を使用
        const pieceChar = pieceName.replace("+","").toUpperCase();
        return `${pieceChar}*${fileTo}${rankTo}`;
    }
    
    const fileFrom = 9 - sel.x;
    const rankFrom = String.fromCharCode(97 + sel.y);
    let moveStr = `${fileFrom}${rankFrom}${fileTo}${rankTo}`;
    if (promoted) moveStr += "+";
    return moveStr;
}

// AIの指し手反映（ポップアップ回避・強制実行）
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
        sel = { x: fromX, y: fromY, fromHand: false };
        doPromote = isPromote;
    }
    // AIはexecuteMoveを直接呼ぶ
    executeMove(sel, toX, toY, doPromote);
}

// ★★★ SFEN生成（後手の持ち駒バグ修正版） ★★★
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
    
    // 先手の持ち駒（ここは元々OK）
    order.forEach(p => {
        const count = hands.black.filter(h => h === p).length;
        if (count === 1) handsStr += p;
        else if (count > 1) handsStr += count + p;
    });

    // 後手の持ち駒（★ここを修正！）
    order.forEach(p => {
        const lowerP = p.toLowerCase();
        // 修正前: const count = hands.white.filter(h => h === lowerP).length;
        // ↓
        // 修正後: 配列の中身は「大文字」なので、大文字(p)で探す必要があります
        const count = hands.white.filter(h => h === p).length;
        
        // 文字列に追加するときは「小文字」にする（SFENのルール）
        if (count === 1) handsStr += lowerP;
        else if (count > 1) handsStr += count + lowerP;
    });

    if (handsStr === "") sfen += "-";
    else sfen += handsStr;
    sfen += " 1";
    return sfen;
}

// ★★★ グラフの初期化関数（間引き禁止・完全固定版） ★★★
function initChart() {
    const ctx = document.getElementById('evalChart').getContext('2d');
    
    if (typeof evalChart !== 'undefined' && evalChart) {
        evalChart.destroy();
    }

    const initialScale = document.getElementById("scaleSelect").value;
    const step = getStepSize(initialScale); // 目盛り幅を計算

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
                            // 0（または50%）の線を濃くする
                            if (mode === "winrate") return (Math.abs(val - 50) < 0.1) ? '#999' : '#eee';
                            return (Math.abs(val) < 0.1) ? '#333' : '#eee';
                        },
                        lineWidth: (context) => {
                            if (!context.tick) return 1;
                            const val = context.tick.value;
                            const modeElem = document.getElementById("modeSelect");
                            const mode = modeElem ? modeElem.value : "score";
                            // 0（または50%）の線を太くする
                            if (mode === "winrate") return (Math.abs(val - 50) < 0.1) ? 2 : 1;
                            return (Math.abs(val) < 0.1) ? 2 : 1;
                        }
                    },
                    // ★ここを修正！間引きを禁止する設定を追加
                    ticks: {
                        stepSize: step,
                        autoSkip: false,   // 勝手に省略しない
                        maxTicksLimit: 100 // たくさん目盛りがあっても許容する
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}


// ★★★ 設定変更時に呼ばれる関数（目盛り固定対応版） ★★★
function updateChartSettings() {
    if (!evalChart) return;

    const mode = document.getElementById("modeSelect").value;
    const scaleVal = document.getElementById("scaleSelect").value;
    const scaleSelectParams = document.getElementById("scaleSelect");

    // モードごとの設定
    if (mode === "winrate") {
        // --- 勝率モード ---
        evalChart.options.scales.y.min = 0;
        evalChart.options.scales.y.max = 100;
        // 勝率は25%刻みで見やすくする
        evalChart.options.scales.y.ticks.stepSize = 25;
        
        evalChart.data.datasets[0].label = "期待勝率 (%)";
        scaleSelectParams.disabled = true;
    } else {
        // --- 評価値モード ---
        const yAxis = evalChart.options.scales.y;
        
        if (scaleVal === "auto") {
            delete yAxis.min;
            delete yAxis.max;
            delete yAxis.ticks.stepSize; // オートなら削除
        } else {
            const num = parseInt(scaleVal, 10);
            yAxis.min = -num;
            yAxis.max = num;
            // ★選択した範囲に合わせて目盛り幅を再設定
            yAxis.ticks.stepSize = getStepSize(scaleVal);
        }
        evalChart.data.datasets[0].label = "評価値 (先手有利がプラス)";
        scaleSelectParams.disabled = false;
    }

    // グラフのデータを現在のモードに合わせて更新
    updateChart();
}

// ★★★ グラフを更新する関数（数値表示機能付き） ★★★
function updateChart() {
    if (!evalChart) return;

    // 1. ラベル（横軸）の調整
    while(evalChart.data.labels.length < evalHistory.length) {
        evalChart.data.labels.push((evalChart.data.labels.length).toString());
    }
    while(evalChart.data.labels.length > evalHistory.length) {
        evalChart.data.labels.pop();
    }

    // 2. データをモードに合わせて変換
    const mode = document.getElementById("modeSelect").value;
    const dataset = evalChart.data.datasets[0];
    
    if (mode === "winrate") {
        dataset.data = evalHistory.map(score => calculateWinRate(score));
    } else {
        dataset.data = [...evalHistory];
    }

    evalChart.update();

    // ★★★ 3. 【追加】数値テキストの更新処理 ★★★
    const latestScore = evalHistory[evalHistory.length - 1] || 0;
    const winRate = calculateWinRate(latestScore).toFixed(1); // 小数点1桁まで（例: 52.5）
    const scoreStr = (latestScore > 0 ? "+" : "") + latestScore; // プラス記号をつける
    
    const evalElem = document.getElementById("numericEval");
    if (evalElem) {
        // 先手番から見た評価値と勝率を表示
        evalElem.textContent = `評価値: ${scoreStr} / 勝率: ${winRate}%`;
        
        // 色を変える演出（お好みで）
        if (latestScore > 200) evalElem.style.color = "red";       // 先手有利
        else if (latestScore < -200) evalElem.style.color = "blue"; // 後手有利
        else evalElem.style.color = "#333";                         // 互角
    }
}


function startPondering() {
    if (gameOver || isPondering) return;
    let positionCmd = "";
    if (typeof skillUsed !== 'undefined' && skillUsed) {
        positionCmd = "position sfen " + generateSfen();
    } else {
        positionCmd = "position startpos moves " + usiHistory.join(" ");
    }
    sendToEngine(positionCmd);
    sendToEngine("go infinite");
    isPondering = true;
    statusDiv.textContent = "「どんな手でくるかな…？」";
    if (ponderTimer) clearTimeout(ponderTimer);
    ponderTimer = setTimeout(() => {
        if (isPondering) {
            stopPondering();
            statusDiv.textContent = "「ちょっときゅうけい…」";
        }
    }, 60000);
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

// ポップアップのボタンから呼ばれる関数
function resolvePromotion(doPromote) {
  const modal = document.getElementById("promoteModal");
  if (modal) modal.style.display = "none";

  if (pendingMove) {
    executeMove(pendingMove.sel, pendingMove.x, pendingMove.y, doPromote);
    pendingMove = null;
  }
}

// ★★★ グラフエリアの表示/非表示を切り替える ★★★
function toggleGraph() {
    const area = document.getElementById("graphArea");
    
    if (area.style.display === "none") {
        area.style.display = "block"; // 表示する
    } else {
        area.style.display = "none";  // 非表示にする（隠す）
    }
}

// ★★★ 計算式：評価値を勝率(%)に変換する関数 ★★★
function calculateWinRate(score) {
    // 600点で勝率73%くらいになる計算式（将棋ソフトで一般的）
    return 1 / (1 + Math.exp(-score / 1200)) * 100;
}

// ★★★ 目盛り幅を計算するヘルパー関数 ★★★
function getStepSize(scaleVal) {
    if (scaleVal === "auto") return undefined; // オートならお任せ
    
    const range = parseInt(scaleVal, 10);
    // 範囲に合わせて、ちょうどいい目盛り幅を返す
    if (range <= 500) return 100;   // ±500なら100刻み
    if (range <= 1000) return 200;  // ±1000なら200刻み
    if (range <= 2000) return 500;  // ±2000なら500刻み
    if (range <= 5000) return 1000; // ±5000なら1000刻み
    return 2000;                    // ±10000なら2000刻み
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

// ==========================================
// 終了・保存ロジック (yaneuraou_main.js 末尾用)
// ==========================================

/**
 * 1. 投了ボタンの挙動を書き換え
 * (HTMLの投了ボタンから直接呼ばれる関数)
 */
function resignGame() {
    if (gameOver) return;
    // HTMLに追加した「resignModal」を表示する
    const modal = document.getElementById("resignModal");
    if (modal) {
        modal.style.display = "flex";
    } else {
        // 万が一モーダルがない場合はブラウザ標準の確認を出す
        if (confirm("投了しますか？")) executeResign();
    }
}

/**
 * 2. 投了の実行
 * (モーダルの「投了」ボタンが押された時に実行)
 */
function executeResign() {
    closeResignModal();
    gameOver = true;
    stopTimer();
    
    // 自分が投了するので、勝者は「後手(white)」
    winner = "white"; 
    
    // Firebaseに結果を保存
    saveGameResult(winner);
    
    // 演出と「ホームに戻る」ボタンを表示
    render();
    if (typeof showKifu === "function") showKifu();
}

/**
 * 3. 投了モーダルを閉じる
 */
function closeResignModal() {
    const modal = document.getElementById("resignModal");
    if (modal) modal.style.display = "none";
}

/**
 * 4. Firebaseへの保存処理本体
 */
function saveGameResult(res) {
    const user = auth.currentUser; // Firebaseのログインユーザーを確認
    if (!user) {
        console.log("未ログインのため、記録は保存されません。");
        return; 
    }

    // HTML側で設定した名前（window.opponentName）を優先
    const opponentDisplayName = window.opponentName || "試験実装AI (最強)"; 
    
    // あなた（先手/black）が勝ったかどうか
    const isWin = (res === "black"); 
    
    // 保存するデータのカタマリを作成
    const gameRecord = {
        date: new Date(),                // 対局日時
        opponent: opponentDisplayName,   // 相手の名前
        moves: moveCount,                // 合計手数
        result: isWin ? "WIN" : "LOSE",  // 勝敗
        mode: "yaneuraou", 
        kifuData: kifu                   // 記録された指し手（配列）
    };

    // Firestoreの「users/ユーザーID」ドキュメントを更新
    db.collection("users").doc(user.uid).update({
        // 勝敗数を+1（インクリメント）
        win: firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
        lose: firebase.firestore.FieldValue.increment(isWin ? 0 : 1),
        // 履歴配列の最後にデータを追加
        history: firebase.firestore.FieldValue.arrayUnion(gameRecord)
    }).then(() => {
        console.log("対局データが正常に保存されました。");
    }).catch((error) => {
        console.error("保存失敗:", error);
    });
}

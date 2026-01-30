// script/main.js (Refactored & Fixed)
// CPU対戦固有のロジックのみを記述

// ★修正：game_core.js ですでに宣言されている変数（boardなど）の定義を削除しました。
// ここには main.js だけで使う resignBtn だけを残します。
const resignBtn = document.getElementById("resignBtn");

// グローバル変数
let lastSkillKifu = "";
let pendingMove = null;
let hasShownEndEffect = false;
window.skillUsed = false;
window.isCaptureRestricted = false;

// 初期化処理
window.addEventListener("load", () => {
  bgm = document.getElementById("bgm");
  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  applyPlayerImage();

  if (resignBtn) resignBtn.addEventListener("click", resignGame);

  // CPU戦用のスキル初期化（自分のキャラのみ）
  const charId = sessionStorage.getItem('char_black') || 'default';
  if (charId === 'default' && typeof CharItsumono !== 'undefined') currentSkill = CharItsumono.skill;
  else if (charId === 'char_a' && typeof CharNekketsu !== 'undefined') currentSkill = CharNekketsu.skill;
  else if (charId === 'char_b' && typeof CharReisei !== 'undefined') currentSkill = CharReisei.skill;
  else currentSkill = null;

  updateSkillButton();
  playBGM();
  startTimer();
  
  // game_core.js の render を呼び出す
  render();
  
  if (typeof showKifu === "function") showKifu();

  const key = getPositionKey();
  positionHistory[key] = 1;
});

// ★★★ GameCore へのフック ★★★
// プレイヤーが駒を動かし終わった後に、自動で呼ばれます
window.onTurnComplete = function() {
    // CPUの思考開始
    if (!isSimulating && cpuEnabled && turn === cpuSide && !gameOver) {
        setTimeout(() => cpuMove(), 1000);
    }
};

// --- 以下、CPU戦固有の入力処理などは残す ---

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
  if (typeof isSkillTargeting !== 'undefined' && isSkillTargeting) {
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

  render();
  if (typeof showKifu === "function") showKifu();
  startTimer();
}

// クリック時の処理
// ※盤面クリック時の挙動はモードごとに微妙に違う（CPU手番判定など）ため、
//   game_coreには移さず、ここでフックして共通処理を呼ぶ形にします。
function onCellClick(x, y) {
  if (gameOver) return;

  // スキルターゲット選択モード
  if (typeof isSkillTargeting !== 'undefined' && isSkillTargeting) {
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

      // CPU思考呼び出し
      if (endsTurn && !isSimulating && cpuEnabled && turn === cpuSide && !gameOver) {
        setTimeout(() => cpuMove(), 1000);
      }
    }
    return;
  }

  // CPUの手番なら無視
  if (cpuEnabled && turn === cpuSide) return;

  // 通常の駒選択
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

  // 移動実行
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
    executeMove(sel, x, y, false); // game_core.js の関数を呼び出す
    return;
  }

  const piece = boardState[sel.y][sel.x];
  const isWhite = piece === piece.toLowerCase();
  const player = isWhite ? "white" : "black";
  const isPromoted = piece.includes("+");
  const base = piece.replace("+","").toUpperCase();

  if (!isPromoted && canPromote(base) && 
      (isInPromotionZone(sel.y, player) || isInPromotionZone(y, player))) {
    
    if (cpuEnabled && turn === cpuSide) {
      executeMove(sel, x, y, true);
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
    winner = "white"; 
    if (typeof saveGameResult === "function") saveGameResult(winner);
    render();
}

function closeResignModal() {
    const modal = document.getElementById("resignModal");
    if (modal) modal.style.display = "none";
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

function saveGameResult(res) {
    const user = auth.currentUser;
    if (!user) return; 
    const opponentDisplayName = window.opponentName || "CPU対局"; 
    const isWin = (res === "black"); 
    const gameRecord = {
        date: new Date(), 
        opponent: opponentDisplayName,
        moves: moveCount,
        result: isWin ? "WIN" : "LOSE",
        mode: "offline",
        kifuData: kifu 
    };
    db.collection("users").doc(user.uid).update({
        win: firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
        lose: firebase.firestore.FieldValue.increment(isWin ? 0 : 1),
        history: firebase.firestore.FieldValue.arrayUnion(gameRecord)
    }).then(() => {
        console.log(opponentDisplayName + " との対局を保存しました");
    });
}

// script/main_player.js (Refactored for PvP)
// 対人戦（オフライン）固有のロジックのみを記述

// ★修正：game_core.js で宣言済みの board などの変数は削除
// ここには main_player.js で使うボタンのみ残す
const resignBtn = document.getElementById("resignBtn");

// ★ PvP用：個別の必殺技管理変数
let p1Skill = null;      // 先手の技オブジェクト
let p2Skill = null;      // 後手の技オブジェクト
let p1SkillCount = 0;    // 先手の使用回数
let p2SkillCount = 0;    // 後手の使用回数

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
  
  // ★game_core.js の render を呼ぶ
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
    executeMove(sel, x, y, false); // game_core.js の機能を使用
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
        mode: "offline_pvp", // ★修正: オフラインPvPとして区別
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

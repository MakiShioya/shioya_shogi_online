// script/yaneuraou_level.js
// やねうら王専用メインスクリプト（Lv1-50完全対応・定跡修正版）

// --- ★レベル別設定テーブル (Lv1～Lv50) ---
const LEVEL_CONFIG = [
    // --- 【入門・初心者帯】 (Lv1-10) 派手に間違える ---
    { id: 1,  name: "Lv1",  nodes: 5000,  depth: 5,  multiPV: 20, noise: 6000, useBook: false },
    { id: 2,  name: "Lv2",  nodes: 6000,  depth: 5,  multiPV: 18, noise: 5500, useBook: false },
    { id: 3,  name: "Lv3",  nodes: 7000,  depth: 6,  multiPV: 16, noise: 5000, useBook: false },
    { id: 4,  name: "Lv4",  nodes: 8000,  depth: 6,  multiPV: 14, noise: 4500, useBook: false },
    { id: 5,  name: "Lv5",  nodes: 9000,  depth: 7,  multiPV: 12, noise: 4000, useBook: false },
    { id: 6,  name: "Lv6",  nodes: 10000, depth: 7,  multiPV: 10, noise: 3500, useBook: false },
    { id: 7,  name: "Lv7",  nodes: 12000, depth: 8,  multiPV: 9,  noise: 3000, useBook: false },
    { id: 8,  name: "Lv8",  nodes: 14000, depth: 8,  multiPV: 8,  noise: 2500, useBook: false },
    { id: 9,  name: "Lv9",  nodes: 16000, depth: 9,  multiPV: 7,  noise: 2000, useBook: false },
    { id: 10, name: "Lv10", nodes: 18000, depth: 9,  multiPV: 6,  noise: 1500, useBook: false },

    // --- 【中級者帯】 (Lv11-20) ミスが減り、少しずつ正確に ---
    { id: 11, name: "Lv11", nodes: 20000, depth: 10, multiPV: 5,  noise: 1200, useBook: false },
    { id: 12, name: "Lv12", nodes: 25000, depth: 10, multiPV: 5,  noise: 1000, useBook: false },
    { id: 13, name: "Lv13", nodes: 30000, depth: 11, multiPV: 4,  noise: 800,  useBook: false },
    { id: 14, name: "Lv14", nodes: 35000, depth: 11, multiPV: 4,  noise: 600,  useBook: false },
    { id: 15, name: "Lv15", nodes: 40000, depth: 12, multiPV: 3,  noise: 500,  useBook: false },
    { id: 16, name: "Lv16", nodes: 45000, depth: 12, multiPV: 3,  noise: 400,  useBook: false },
    { id: 17, name: "Lv17", nodes: 50000, depth: 13, multiPV: 2,  noise: 300,  useBook: false },
    { id: 18, name: "Lv18", nodes: 60000, depth: 13, multiPV: 2,  noise: 200,  useBook: false },
    { id: 19, name: "Lv19", nodes: 70000, depth: 14, multiPV: 2,  noise: 100,  useBook: false },
    { id: 20, name: "Lv20", nodes: 80000, depth: 14, multiPV: 1,  noise: 0,    useBook: false },

    // --- 【上級者帯】 (Lv21-30) 定跡解禁・本格派 ---
    { id: 21, name: "Lv21", nodes: 90000,  depth: 15, multiPV: 1, noise: 0, useBook: true },
    { id: 22, name: "Lv22", nodes: 100000, depth: 15, multiPV: 1, noise: 0, useBook: true },
    { id: 23, name: "Lv23", nodes: 120000, depth: 16, multiPV: 1, noise: 0, useBook: true },
    { id: 24, name: "Lv24", nodes: 140000, depth: 16, multiPV: 1, noise: 0, useBook: true },
    { id: 25, name: "Lv25", nodes: 160000, depth: 17, multiPV: 1, noise: 0, useBook: true },
    { id: 26, name: "Lv26", nodes: 180000, depth: 17, multiPV: 1, noise: 0, useBook: true },
    { id: 27, name: "Lv27", nodes: 200000, depth: 18, multiPV: 1, noise: 0, useBook: true },
    { id: 28, name: "Lv28", nodes: 250000, depth: 18, multiPV: 1, noise: 0, useBook: true },
    { id: 29, name: "Lv29", nodes: 300000, depth: 19, multiPV: 1, noise: 0, useBook: true },
    { id: 30, name: "Lv30", nodes: 400000, depth: 19, multiPV: 1, noise: 0, useBook: true },

    // --- 【有段者・強豪帯】 (Lv31-40) 読みが深くなる ---
    { id: 31, name: "Lv31", nodes: 500000,  depth: 20, multiPV: 1, noise: 0, useBook: true },
    { id: 32, name: "Lv32", nodes: 600000,  depth: 20, multiPV: 1, noise: 0, useBook: true },
    { id: 33, name: "Lv33", nodes: 700000,  depth: 21, multiPV: 1, noise: 0, useBook: true },
    { id: 34, name: "Lv34", nodes: 800000,  depth: 21, multiPV: 1, noise: 0, useBook: true },
    { id: 35, name: "Lv35", nodes: 900000,  depth: 22, multiPV: 1, noise: 0, useBook: true },
    { id: 36, name: "Lv36", nodes: 1000000, depth: 22, multiPV: 1, noise: 0, useBook: true },
    { id: 37, name: "Lv37", nodes: 1200000, depth: 23, multiPV: 1, noise: 0, useBook: true },
    { id: 38, name: "Lv38", nodes: 1500000, depth: 23, multiPV: 1, noise: 0, useBook: true },
    { id: 39, name: "Lv39", nodes: 1800000, depth: 24, multiPV: 1, noise: 0, useBook: true },
    { id: 40, name: "Lv40", nodes: 2000000, depth: 24, multiPV: 1, noise: 0, useBook: true },

    // --- 【最強・神の領域】 (Lv41-50) ---
    { id: 41, name: "Lv41", nodes: 2500000,  depth: 25, multiPV: 1, noise: 0, useBook: true },
    { id: 42, name: "Lv42", nodes: 3000000,  depth: 26, multiPV: 1, noise: 0, useBook: true },
    { id: 43, name: "Lv43", nodes: 3500000,  depth: 27, multiPV: 1, noise: 0, useBook: true },
    { id: 44, name: "Lv44", nodes: 4000000,  depth: 28, multiPV: 1, noise: 0, useBook: true },
    { id: 45, name: "Lv45", nodes: 5000000,  depth: 29, multiPV: 1, noise: 0, useBook: true },
    { id: 46, name: "Lv46", nodes: 6000000,  depth: 30, multiPV: 1, noise: 0, useBook: true },
    { id: 47, name: "Lv47", nodes: 7000000,  depth: 30, multiPV: 1, noise: 0, useBook: true },
    { id: 48, name: "Lv48", nodes: 8000000,  depth: 30, multiPV: 1, noise: 0, useBook: true },
    { id: 49, name: "Lv49", nodes: 9000000,  depth: 30, multiPV: 1, noise: 0, useBook: true },
    { id: 50, name: "Lv50", nodes: 10000000, depth: 30, multiPV: 1, noise: 0, useBook: true }
];

// URLパラメータからレベルを取得
const urlParams = new URLSearchParams(window.location.search);
const lvParam = parseInt(urlParams.get('lv')) || 1;
// ここで現在のレベル設定を確定させる
const currentLevelSetting = LEVEL_CONFIG.find(c => c.id === lvParam) || LEVEL_CONFIG[0];

// ---------------------------------------------------

let usiHistory = [];
let isEngineReady = false;
let evalHistory = [0];
let evalChart = null;
let isPondering = false;
let ponderTimer = null;
let isStoppingPonder = false;
let hasShownEndEffect = false;
let candidateMoves = [];

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

// ★ポイント設定
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

// ★思考結果受信（定跡有効化・ノイズ・振り飛車ボーナス対応）
function handleEngineMessage(msg) {
    // 1. 候補手情報の解析
    if (typeof msg === "string" && msg.startsWith("info") && msg.includes("pv")) {
        let pvIndex = 1;
        const matchPv = msg.match(/multipv (\d+)/);
        if (matchPv) pvIndex = parseInt(matchPv[1]);

        let score = 0;
        const matchScore = msg.match(/score cp ([\-\d]+)/);
        const matchMate = msg.match(/score mate ([\-\d]+)/);

        if (matchScore) score = parseInt(matchScore[1]);
        else if (matchMate) score = (parseInt(matchMate[1]) > 0) ? 30000 : -30000;

        // ★pvの誤検知を防ぐ正規表現
        const matchMove = msg.match(/\bpv\s+([a-zA-Z0-9\+\*]+)/);
        if (matchMove) {
            const move = matchMove[1];
            const existingIdx = candidateMoves.findIndex(c => c.id === pvIndex);
            if (existingIdx !== -1) {
                candidateMoves[existingIdx] = { id: pvIndex, move: move, score: score };
            } else {
                candidateMoves.push({ id: pvIndex, move: move, score: score });
            }
        }
        
        if (pvIndex === 1) {
            let graphScore = score;
            if (turn === "white") graphScore = -graphScore;
            evalHistory[moveCount] = graphScore;
            for(let i = 0; i < moveCount; i++) {
                if (evalHistory[i] === undefined) evalHistory[i] = evalHistory[i-1] || 0;
            }
            updateChart();
        }
    }

    if (msg === "usiok") {
        sendToEngine("isready");
    }
    else if (msg === "readyok") {
        isEngineReady = true;
        
        // ★定跡の制御（修正：コメントアウトを解除しました）
        if (currentLevelSetting.useBook) {
            console.log("定跡をONにします");
            // 定跡ファイル名を指定（環境に合わせて変更してください）
            sendToEngine("setoption name BookFile value user_book1.db"); 
        } else {
            console.log("定跡をOFFにします");
            sendToEngine("setoption name BookFile value no_book"); 
        }

        statusDiv.textContent = (cpuSide === "white") ? "対局開始！ あなたは【先手】です。" : "対局開始！ あなたは【後手】です。";
        if (turn === cpuSide) setTimeout(() => cpuMove(), 1000);
    }
    else if (typeof msg === "string" && msg.startsWith("bestmove")) {
        const parts = msg.split(" ");
        let bestMove = parts[1];
        
        if (isStoppingPonder) {
             isStoppingPonder = false;
             return;
        }
        if (turn !== cpuSide) return;
        
        if (bestMove === "resign") { resignGame(); return; }
        else if (bestMove === "win") { gameOver = true; return; }

        // ▼ ノイズ・振り飛車ボーナス処理 ▼
        if (currentLevelSetting.noise > 0 && candidateMoves.length > 0) {
            const noiseRange = currentLevelSetting.noise;
            const isOddLevel = (currentLevelSetting.id % 2 !== 0); 
            const isOpening = (moveCount <= 12); 

            const noisyCandidates = candidateMoves.map(c => {
                const noise = (Math.random() - 0.5) * 2 * noiseRange;
                let finalScore = c.score + noise;
                let bonusLog = "";

                if (isOddLevel && isOpening) {
                    let isRangingRook = false;
                    if (turn === "black") {
                        if (c.move.match(/^2h[3-8]h/)) isRangingRook = true;
                    } else {
                        if (c.move.match(/^8b[2-7]b/)) isRangingRook = true;
                    }
                    if (isRangingRook) {
                        finalScore += 2000; 
                        bonusLog = " [振り飛車!]";
                    }
                }
                
                // デバッグログ（必要ならコメントアウト解除）
                // console.log(`手:${c.move} 最終:${Math.floor(finalScore)}${bonusLog}`);
                
                return { move: c.move, finalScore: finalScore };
            });

            noisyCandidates.sort((a, b) => b.finalScore - a.finalScore);
            bestMove = noisyCandidates[0].move;
        }
        // ▲▲▲

        applyUsiMove(bestMove);
        if (!gameOver) setTimeout(startPondering, 500);
    }
}

// ★思考開始処理（序盤短縮ロジック追加版）
function cpuMove() {
    if (gameOver) return;
    if (!isEngineReady) {
        setTimeout(cpuMove, 1000);
        return;
    }

    stopPondering(); 
    candidateMoves = [];

    statusDiv.textContent = `考え中... (${currentLevelSetting.name})`;
    let positionCmd = "";

    if ((typeof window.skillUsed !== 'undefined' && window.skillUsed) || usiHistory.length === 0 || isCpuDoubleAction) {
        positionCmd = "position sfen " + generateSfen();
    } else {
        positionCmd = "position startpos moves " + usiHistory.join(" ");
    }
    sendToEngine(positionCmd);

    const pvNum = currentLevelSetting.multiPV || 1;
    sendToEngine(`setoption name MultiPV value ${pvNum}`);

    // ★重要：序盤思考時間短縮ロジック
    let nodesLimit = currentLevelSetting.nodes;
    let depthLimit = currentLevelSetting.depth || 30;

    // 24手目までは、どんな高レベルでも60万ノード（約1~2秒）で打ち切る
    if (usiHistory.length < 24) {
        const OPENING_CAP = 600000; 
        if (nodesLimit > OPENING_CAP) {
            console.log(`[時短] 序盤のため計算量を制限: ${nodesLimit} -> ${OPENING_CAP}`);
            nodesLimit = OPENING_CAP;
        }
    }

    console.log(`Lv:${currentLevelSetting.name}, Nodes:${nodesLimit}, Depth:${depthLimit}`);
    sendToEngine(`go btime 0 wtime 0 nodes ${nodesLimit} depth ${depthLimit}`);
}

// 先読み（Lv10以上のみ）
function startPondering() {
    if (gameOver || isPondering) return;
    if (currentLevelSetting.id < 10) return;

    let positionCmd = "";
    if (typeof window.skillUsed !== 'undefined' && window.skillUsed) {
        positionCmd = "position sfen " + generateSfen();
    } else {
        positionCmd = "position startpos moves " + usiHistory.join(" ");
    }
    sendToEngine(positionCmd);
    sendToEngine("setoption name MultiPV value 1");
    sendToEngine("go infinite");
    
    isPondering = true;
    if (ponderTimer) clearTimeout(ponderTimer);
    ponderTimer = setTimeout(() => {
        if (isPondering) stopPondering();
    }, 60000);
}

function stopPondering() {
    if (isPondering) {
        isStoppingPonder = true; 
        sendToEngine("stop");
        isPondering = false;
        if (ponderTimer) clearTimeout(ponderTimer);
    }
}

// --- その他の関数は変更なし ---

function executeMove(sel, x, y, doPromote) {
  if (typeof stopPondering === "function") stopPondering();

  if (!gameOver && turn === cpuSide && !isCpuDoubleAction && typeof CpuDoubleAction !== 'undefined') {
      const cost = CpuDoubleAction.getCost();
      if (cpuSkillPoint >= cost) {
          consumeCpuSkillPoint(cost);
          isCpuDoubleAction = true;
          cpuSkillUseCount++;
          
          window.skillUsed = true; 
          usiHistory = []; 

          playSkillEffect("boss_cutin.png", ["boss.mp3", "skill.mp3"], "dark"); 
          statusDiv.textContent = `CPUが必殺技【${CpuDoubleAction.name}】を発動！`;
          
          setTimeout(() => { executeMove(sel, x, y, doPromote); }, 1500);
          return; 
      }
  }

  const pieceBefore = sel.fromHand ? hands[sel.player][sel.index] : boardState[sel.y][sel.x];
  history.push(deepCopyState());
  
  // 移動元記録
  if (sel.fromHand) lastMoveFrom = null;
  else lastMoveFrom = { x: sel.x, y: sel.y };

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
      lastMoveTo = null; 
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
      if (captured !== "") gain += getPoint(SP_CONFIG.CAPTURE, captured);
      
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
                if (emptyCount > 0) { sfen += emptyCount; emptyCount = 0; }
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
                    grid: { color: (context) => (!context.tick ? '#eee' : (Math.abs(context.tick.value) < 0.1 ? '#333' : '#eee')) },
                    ticks: { stepSize: step, autoSkip: false, maxTicksLimit: 100 }
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
        evalElem.style.color = (latestScore > 200 ? "red" : (latestScore < -200 ? "blue" : "#333"));
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
            setTimeout(() => { evalChart.resize(); updateChart(); }, 50);
        }
    } else {
        area.style.display = "none";
    }
}

function calculateWinRate(score) { return 1 / (1 + Math.exp(-score / 1200)) * 100; }

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

function toggleVolume() { document.getElementById("volumeModal").style.display = "flex"; }
function updateVolume() {
    const bgm = document.getElementById("bgm");
    const range = document.getElementById("bgmRange");
    if (bgm && range) { bgm.volume = range.value; bgm.muted = false; }
}
function closeVolumeModal() { document.getElementById("volumeModal").style.display = "none"; }
function showRules() { document.getElementById("rulesModal").style.display = "flex"; }
function closeRulesModal() { document.getElementById("rulesModal").style.display = "none"; }
function toggleMenu() {
    const panel = document.getElementById('menuPanel');
    if (panel) panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
}
function copyKifuText() {
    const kifuDiv = document.getElementById("kifu");
    if (kifuDiv) {
        navigator.clipboard.writeText(kifuDiv.innerText).then(() => alert("棋譜をコピーしました！"));
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

function closeResignModal() { document.getElementById("resignModal").style.display = "none"; }

function saveGameResult(res) {
    const user = auth.currentUser; 
    if (!user) return; 

    // ★修正：記録名を「CPU Lv〇〇」にする
    const levelName = currentLevelSetting ? currentLevelSetting.name : "Lv?";
    const opponentDisplayName = `CPU ${levelName}`;
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
    }).catch(console.error);
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

// --- ゲージ管理用 ---
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

// script/yaneuraou_level.js
// やねうら王専用メインスクリプト（グラフ機能強化・修正版）

// --- ★やねうら王用 設定変数 ---

// --- ★レベル別設定テーブル ---
// nodes: 読む局面の数（少ないほど弱く、早い）
// name: 画面表示用の名前
// --- ★レベル別設定テーブル ---
// nodes: 思考量
// depth: 読みの深さ
// multiPV: 候補手の数（多いほど、2番手・3番手の悪手を選ぶ余地が生まれる）
// noise: 評価値に加える乱数の幅（点数）。大きいほど判断が狂う。
// script/yaneuraou_level.js の LEVEL_CONFIG をこれに書き換え

// --- ★レベル別設定テーブル (Lv1～Lv50) ---
// nodes: 思考量
// depth: 読みの深さ
// multiPV: 候補手の数（多いほど、悪手を選ぶ余地が生まれる）
// noise: 評価値に加える乱数の幅。大きいほど判断が狂う。
// useBook: 定跡を使うかどうか（Lv21からON）

const LEVEL_CONFIG = [

    { id: 1,  name: "Lv1",  nodes: 1000,  depth: 1,  multiPV: 10, noise: 4000, useBook: false },
    { id: 2,  name: "Lv2",  nodes: 1000,  depth: 2,  multiPV: 10, noise: 3000, useBook: false },
    { id: 3,  name: "Lv3",  nodes: 1000,  depth: 3,  multiPV: 10, noise: 2500, useBook: false },
    { id: 4,  name: "Lv4",  nodes: 2000,  depth: 4,  multiPV: 10, noise: 2200, useBook: false },
    { id: 5,  name: "Lv5",  nodes: 4000,  depth: 5,  multiPV: 10, noise: 1900, useBook: false },
    { id: 6,  name: "Lv6",  nodes: 8000, depth: 6,  multiPV: 9, noise: 1700, useBook: false },
    { id: 7,  name: "Lv7",  nodes: 8600, depth: 7,  multiPV: 9,  noise: 1500, useBook: false },
    { id: 8,  name: "Lv8",  nodes: 9200, depth: 7,  multiPV: 9,  noise: 1400, useBook: false },
    { id: 9,  name: "Lv9",  nodes: 10000, depth: 7,  multiPV: 9,  noise: 1300, useBook: false },
    { id: 10, name: "Lv10", nodes: 11000, depth: 8,  multiPV: 9,  noise: 1200, useBook: false },

    { id: 11, name: "Lv11", nodes: 12000, depth: 8, multiPV: 8,  noise: 1100, useBook: false },
    { id: 12, name: "Lv12", nodes: 14000, depth: 8, multiPV: 8,  noise: 1000, useBook: false },
    { id: 13, name: "Lv13", nodes: 15000, depth: 9, multiPV: 8,  noise: 900,  useBook: false },
    { id: 14, name: "Lv14", nodes: 16000, depth: 9, multiPV: 8,  noise: 800,  useBook: false },
    { id: 15, name: "Lv15", nodes: 18000, depth: 9, multiPV: 8,  noise: 700,  useBook: false },
    { id: 16, name: "Lv16", nodes: 20000, depth: 10, multiPV: 7,  noise: 600,  useBook: false },
    { id: 17, name: "Lv17", nodes: 22000, depth: 10, multiPV: 7,  noise: 500,  useBook: false },
    { id: 18, name: "Lv18", nodes: 25000, depth: 10, multiPV: 7,  noise: 450,  useBook: false },
    { id: 19, name: "Lv19", nodes: 28000, depth: 11, multiPV: 7,  noise: 400,  useBook: false },
    { id: 20, name: "Lv20", nodes: 31000, depth: 11, multiPV: 7,  noise: 350,    useBook: false }, 

    { id: 21, name: "Lv21", nodes: 35000,  depth: 11, multiPV: 6, noise: 300, useBook: false },
    { id: 22, name: "Lv22", nodes: 38000, depth: 12, multiPV: 6, noise: 250, useBook: false },
    { id: 23, name: "Lv23", nodes: 41000, depth: 12, multiPV: 6, noise: 200, useBook: false },
    { id: 24, name: "Lv24", nodes: 45000, depth: 12, multiPV: 6, noise: 150, useBook: false },
    { id: 25, name: "Lv25", nodes: 50000, depth: 13, multiPV: 6, noise: 120, useBook: false },
    { id: 26, name: "Lv26", nodes: 55000, depth: 13, multiPV: 5, noise: 100, useBook: false },
    { id: 27, name: "Lv27", nodes: 60000, depth: 13, multiPV: 5, noise: 90, useBook: false },
    { id: 28, name: "Lv28", nodes: 66000, depth: 14, multiPV: 5, noise: 80, useBook: false },
    { id: 29, name: "Lv29", nodes: 72000, depth: 14, multiPV: 5, noise: 70, useBook: false },
    { id: 30, name: "Lv30", nodes: 80000, depth: 14, multiPV: 5, noise: 60, useBook: false },

    { id: 31, name: "Lv31", nodes: 82000,  depth: 15, multiPV: 4, noise: 55, useBook: true },
    { id: 32, name: "Lv32", nodes: 90000,  depth: 15, multiPV: 4, noise: 50, useBook: true },
    { id: 33, name: "Lv33", nodes: 100000,  depth: 15, multiPV: 4, noise: 45, useBook: true },
    { id: 34, name: "Lv34", nodes: 110000,  depth: 16, multiPV: 4, noise: 40, useBook: true },
    { id: 35, name: "Lv35", nodes: 120000,  depth: 16, multiPV: 4, noise: 35, useBook: true },
    { id: 36, name: "Lv36", nodes: 140000, depth: 16, multiPV: 3, noise: 32, useBook: true },
    { id: 37, name: "Lv37", nodes: 150000, depth: 17, multiPV: 3, noise: 29, useBook: true },
    { id: 38, name: "Lv38", nodes: 160000, depth: 17, multiPV: 3, noise: 26, useBook: true },
    { id: 39, name: "Lv39", nodes: 180000, depth: 17, multiPV: 3, noise: 23, useBook: true },
    { id: 40, name: "Lv40", nodes: 200000, depth: 18, multiPV: 3, noise: 20, useBook: true },

    { id: 41, name: "Lv41", nodes: 220000,  depth: 18, multiPV: 2, noise: 18, useBook: true },
    { id: 42, name: "Lv42", nodes: 250000,  depth: 18, multiPV: 2, noise: 16, useBook: true },
    { id: 43, name: "Lv43", nodes: 300000,  depth: 19, multiPV: 2, noise: 14, useBook: true },
    { id: 44, name: "Lv44", nodes: 350000,  depth: 19, multiPV: 2, noise: 12, useBook: true },
    { id: 45, name: "Lv45", nodes: 400000,  depth: 19, multiPV: 2, noise: 10, useBook: true },
    { id: 46, name: "Lv46", nodes: 460000,  depth: 20, multiPV: 1, noise: 8, useBook: true },
    { id: 47, name: "Lv47", nodes: 520000,  depth: 20, multiPV: 1, noise: 6, useBook: true },
    { id: 48, name: "Lv48", nodes: 600000,  depth: 20, multiPV: 1, noise: 4, useBook: true },
    { id: 49, name: "Lv49", nodes: 800000,  depth: 21, multiPV: 1, noise: 2, useBook: true },
    { id: 50, name: "Lv50", nodes: 900000, depth: 22, multiPV: 1, noise: 0, useBook: true }
];
// 現在のレベル（初期値はLv1にしておきます）
let currentLevelSetting = LEVEL_CONFIG[0];

// URLパラメータからレベルを指定できるようにする場合の処理（オプション）
// 例: cpu_level.html?lv=5 でアクセスした場合
const urlParams = new URLSearchParams(window.location.search);
const lvParam = parseInt(urlParams.get('lv'));
if (lvParam) {
    const found = LEVEL_CONFIG.find(c => c.id === lvParam);
    if (found) currentLevelSetting = found;
}


let usiHistory = []; // 棋譜（USI形式）を記録する配列
let isEngineReady = false; // エンジンの準備ができているか
let evalHistory = [0]; // 評価値の履歴（初期値0）
let evalChart = null;  // グラフのインスタンス
let isPondering = false; // 先読み中かどうか
let ponderTimer = null;  // 休憩用のタイマー
let isStoppingPonder = false;// Ponder停止中かどうかのフラグ
let hasShownEndEffect = false;
let candidateMoves = [];
let targetRookFile = 0;

// ▼▼▼ この部分が足りていません！ここに追加してください ▼▼▼

// ★必殺技・ゲージ関連の変数
window.skillUsed = false;
window.isCaptureRestricted = false;
let lastSkillKifu = "";
let pendingMove = null;

// ★CPU 2回行動用
let isCpuDoubleAction = false;
let cpuSkillUseCount = 0;

// ★ゲージ用ポイント（エラーの原因はこれがないことです！）
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

// ▲▲▲ ここまで ▲▲▲
// DOM要素の参照
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

  if (resignBtn) {
    resignBtn.addEventListener("click", resignGame);
  }

  // ★★★ 1. 先手・後手のランダム決定 ★★★
  const isPlayerBlack = Math.random() < 0.5;

  if (isPlayerBlack) {
      // プレイヤーが先手
      cpuSide = "white"; // AIは後手
      document.body.classList.remove("view-white");
      updateHandLayout("black"); // 駒台配置：標準
  } else {
      // プレイヤーが後手
      cpuSide = "black"; // AIは先手
      document.body.classList.add("view-white"); // 盤面反転
      updateHandLayout("white"); // 駒台配置：反転
  }
  // ★★★★★★★★★★★★★★★★★★★★★

  // 画像反映（反転クラス付与後に呼ぶ）
  applyPlayerImage();

  const charId = sessionStorage.getItem('char_black') || 'default';
 
  if (charId === 'default' && typeof CharItsumono !== 'undefined') {
    currentSkill = CharItsumono.skill;
  } else if (charId === 'char_a' && typeof CharNekketsu !== 'undefined') {
    currentSkill = CharNekketsu.skill;
  } else if (charId === 'char_b' && typeof CharReisei !== 'undefined') {
    currentSkill = CharReisei.skill;
  } else if (charId === 'char_d') {
    // ★ここを特に注意深く修正
    if (typeof CharMachida !== 'undefined') {
        currentSkill = CharMachida.skill;
    } else {
        console.warn("CharMachida is not defined. Skipping skill assignment.");
    }
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
  firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            applyUserSkin();
        }
    });
});

function sendToEngine(msg) {
    if (typeof engineWorker !== 'undefined' && engineWorker) {
        engineWorker.postMessage(msg);
    } else {
        console.error("Workerが見つかりません:", msg);
    }
}

// script/yaneuraou_level.js の handleEngineMessage をこれに書き換え

// script/yaneuraou_level.js の handleEngineMessage をこれに書き換え

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
            updateChart();
        }
    }

    if (msg === "usiok") {
        sendToEngine("isready");
    }
    else if (msg === "readyok") {
        isEngineReady = true;
        
        // 作戦決定
        const strategyType = Math.floor(Math.random() * 4);
        
        if (cpuSide === "white") {
            const files = [5, 4, 3];
            targetRookFile = files[strategyType];
            console.log(`[作戦] CPU(後手)の狙い: ${targetRookFile}筋`);
        } else {
            const files = [5, 6, 7];
            targetRookFile = files[strategyType];
            console.log(`[作戦] CPU(先手)の狙い: ${targetRookFile}筋`);
        }

        // 定跡制御：奇数レベルなら一旦OFF
        const isOddLevel = (currentLevelSetting.id % 2 !== 0);

        if (currentLevelSetting.useBook && !isOddLevel) {
            console.log("定跡をONにします");
            sendToEngine("setoption name BookFile value user_book1.db"); 
        } else {
            console.log("定跡をOFFにします（戦型指定のため）");
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

        // ▼▼▼ 振り飛車 強制注入 & ノイズ処理 ▼▼▼
        
        const isOddLevel = (currentLevelSetting.id % 2 !== 0); 
        const isOpening = (moveCount <= 16); 
        
        // ★注入ロジック
        if (isOddLevel && isOpening) {
            let rookX = -1, rookY = -1;
            for(let y=0; y<9; y++){
                for(let x=0; x<9; x++){
                    const p = boardState[y][x];
                    if(!p) continue;
                    if (turn === "black" && p === "R") { rookX = x; rookY = y; }
                    else if (turn === "white" && p === "r") { rookX = x; rookY = y; }
                }
            }

            if (rookX !== -1) {
                // --- ★ここが追加された初期位置チェック ---
                // 先手(2h)は [7][7]、後手(8b)は [1][1]
                const isInitialPos = (turn === "black" && rookX === 7 && rookY === 7) || 
                                     (turn === "white" && rookX === 1 && rookY === 1);

                if (isInitialPos) {
                    const targetX = 9 - targetRookFile;
                    if (rookX !== targetX) {
                        const targetY = rookY;
                        const legal = getLegalMoves(rookX, rookY);
                        const canMove = legal.some(m => m.x === targetX && m.y === targetY);
    
                        if (canMove) {
                            const fileFrom = 9 - rookX;
                            const rankFrom = String.fromCharCode(97 + rookY);
                            const fileTo = 9 - targetX;
                            const rankTo = String.fromCharCode(97 + targetY);
                            const furiMove = `${fileFrom}${rankFrom}${fileTo}${rankTo}`;
    
                            const exists = candidateMoves.some(c => c.move === furiMove);
                            
                            if (!exists) {
                                // 注入時はボーナスなしのスコアで追加
                                const baseScore = (candidateMoves.length > 0) ? candidateMoves[0].score : 0;
                                console.log(`[強制注入] ${furiMove} を候補に追加しました`);
                                candidateMoves.push({
                                    id: 999, 
                                    move: furiMove,
                                    score: baseScore 
                                });
                            }
                        }
                    }
                }
                // --- チェック終了 ---
            }
        }

        // ▼▼▼ 最終選択（ここでボーナスを一括加算！）
        if (candidateMoves.length > 0) {
            const noiseRange = currentLevelSetting.noise;
            
            const noisyCandidates = candidateMoves.map(c => {
                const noise = (noiseRange > 0) ? (Math.random() - 0.5) * 2 * noiseRange : 0;
                let finalScore = c.score + noise;
                
                // 狙いの筋ならボーナスを与える（注入された手も、元からあった手も）
                if (isOddLevel && isOpening) {
                    let isTarget = false;
                    if (turn === "black" && c.move === `2h${targetRookFile}h`) isTarget = true;
                    if (turn === "white" && c.move === `8b${targetRookFile}b`) isTarget = true;
                    
                    if (isTarget) {
                        finalScore += 300; 
                    }
                }

                return { move: c.move, finalScore: finalScore };
            });

            noisyCandidates.sort((a, b) => b.finalScore - a.finalScore);
            bestMove = noisyCandidates[0].move;
        }
        
        // --- 狙い通りの手を指したら、定跡をONに戻す ---
        if (isOddLevel && currentLevelSetting.useBook) {
            let executedStrategy = false;
            if (turn === "black") {
                if (bestMove === `2h${targetRookFile}h`) executedStrategy = true;
            } else {
                if (bestMove === `8b${targetRookFile}b`) executedStrategy = true;
            }

            if (executedStrategy) {
                console.log(`★狙い通りの${targetRookFile}筋に振りました！定跡(Book)をONに復帰させます。`);
                sendToEngine("setoption name BookFile value user_book1.db");
            }
        }
        // -----------------------------------------------------------------

        applyUsiMove(bestMove);
        if (!gameOver) setTimeout(startPondering, 500);
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
  const isWhiteMode = document.body.classList.contains("view-white");
  // 後手モードなら whiteHandBox、そうでなければ blackHandBox が「自分の台」
  const myBoxId = isWhiteMode ? "whiteHandBox" : "blackHandBox";
  const myBox = document.getElementById(myBoxId);
  
  if (!myBox) return;
  
  const charId = sessionStorage.getItem('char_black') || 'default';
  let imageUrl = "";
  if (charId === 'default') imageUrl = "url('script/image/karui_1p.PNG')";
  else if (charId === 'char_a') imageUrl = "url('script/image/char_a.png')";
  else if (charId === 'char_b') imageUrl = "url('script/image/char_b.png')";
  else if (charId === 'char_d') imageUrl = "url('script/image/char_d.png')";
  
  if (imageUrl) myBox.style.backgroundImage = imageUrl;
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
  
  // 2手前の状態を取得
  const prev = history[history.length - 2];
  history.length -= 2; 

  // 評価値履歴を戻す
  if (evalHistory.length > 2) {
      evalHistory.length -= 2;
      updateChart();
  }

  // USI履歴を戻す
  if (usiHistory.length >= 2) {
      usiHistory.length -= 2;
  }

  // ★復元処理（restoreState関数がない場合も想定して直書き）
  boardState = JSON.parse(JSON.stringify(prev.boardState));
  hands = JSON.parse(JSON.stringify(prev.hands));
  turn = prev.turn;
  moveCount = prev.moveCount;
  
  // kifu配列も戻す（これが抜けていると「19手目」などと表示がズレてバグります）
  kifu = JSON.parse(JSON.stringify(prev.kifu));

  lastMoveTo = prev.lastMoveTo ? { ...prev.lastMoveTo } : null;
  lastMoveFrom = prev.lastMoveFrom ? { ...prev.lastMoveFrom } : null;

  window.isCaptureRestricted = false;
  
  // TimeWarpはskillUsedをfalseに戻すべき
  // (ただし、もし戻った先が既に必殺技使用後の状態ならtrueにする必要があるが、
  //  今回は「TimeWarp自体はskillUsedを消費しない」運用にする)
  // window.skillUsed = false; 

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
    // 進行中の表示
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
        
        // ★ハイブリッド方式：駒コンテナの作成
        const container = document.createElement("div");
        container.className = "piece-container";
        if (isWhite) {
            container.classList.add("gote");
        }
        const baseType = piece.replace("+", "").toUpperCase();
        container.classList.add("size-" + baseType);
        // 文字部分
        const textSpan = document.createElement("span");
        textSpan.className = "piece-text";
        if (key.startsWith("+")) textSpan.classList.add("promoted");
        
        // 1文字のみ表示（例：「成香」→「香」）
        const name = pieceName[key];
        textSpan.textContent = name.length > 1 ? name[name.length - 1] : name;

        // 色付き演出の適用
        if (pieceStyles[y][x] === "green") {
          textSpan.style.color = "#32CD32";
          textSpan.style.fontWeight = "bold";
          textSpan.style.textShadow = "1px 1px 0px #000";
        } else if (pieceStyles[y][x] === "blue") {
          textSpan.style.color = "#1E90FF";
          textSpan.style.fontWeight = "bold";
          textSpan.style.textShadow = "1px 1px 0px #000";
        }

        container.appendChild(textSpan);
        td.appendChild(container);

        if (isWhite) td.style.transform = "rotate(180deg)";

        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) {
          td.classList.add("moved");
        }
      }
      if (lastMoveFrom && lastMoveFrom.x === x && lastMoveFrom.y === y) {
          td.classList.add("move-from");
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

  // 持ち駒生成ヘルパー（内部関数）
  const createHandPiece = (player, p, i) => {
      const container = document.createElement("div");
      container.className = "hand-piece-container";
      if (player === "white") {
          container.classList.add("gote");
      }
      const textSpan = document.createElement("span");
      textSpan.className = "piece-text";
      textSpan.textContent = pieceName[p];
      
      container.appendChild(textSpan);

      if (selected && selected.fromHand && selected.player === player && selected.index === i) {
          container.classList.add("selected");
      }
      
      container.onclick = () => selectFromHand(player, i);

      // 持ち駒反転

      if (player === cpuSide) {
          container.style.transform = "rotate(180deg)";
      }

      return container;
  };

  hands.black.forEach((p, i) => {
      blackHandDiv.appendChild(createHandPiece("black", p, i));
  });

  hands.white.forEach((p, i) => {
      whiteHandDiv.appendChild(createHandPiece("white", p, i));
  });
}

function onCellClick(x, y) {
  if (gameOver) return;

  // --- 必殺技発動モード ---
  if (isSkillTargeting) {
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      
      // ★★★ ここから：時戻し（TimeWarp）用の特別処理 ★★★
      if (currentSkill && currentSkill.isSystemAction) {
        
        if (typeof stopPondering === "function") stopPondering();

        // 1. 演出を実行
        currentSkill.execute(x, y);

        // 2. ターゲットモードを解除
        isSkillTargeting = false;
        legalMoves = [];
        selected = null;
        
        const boardTable = document.getElementById("board");
        if (boardTable) {
            boardTable.classList.remove("skill-targeting-mode");
        }

        // 3. 実際に「待った」を実行
        if (typeof undoMove === "function") {
             undoMove();
        }

        // 4. ★重要★ TimeWarpは「必殺技フラグ(skillUsed)」を立ててはいけない！
        // フラグを立てると履歴記録が止まり、エンジンがおかしくなります。
        // window.skillUsed = true;  <-- これは削除！
        
        // 代わりに回数カウントだけ増やす（ボタン制御用）
        skillUseCount++; 
        
        updateSkillButton();
        render();
        statusDiv.textContent = "必殺技発動！ 時を戻しました。";
        return; 
      }
      // ★★★ ここまで ★★★

      // --- 以下、通常の必殺技（BluePrintなど）の処理 ---
      if (typeof stopPondering === "function") stopPondering();

      const result = currentSkill.execute(x, y);
      if (result === null) {
          const nextTargets = currentSkill.getValidTargets();
          if (nextTargets && nextTargets.length > 0) {
              legalMoves = nextTargets;
              render();
              statusDiv.textContent = `必殺技【${currentSkill.name}】：移動先を選んでください`;
          } else {
              alert("有効な移動先がありません。");
              if (currentSkill.reset) currentSkill.reset();
              isSkillTargeting = false;
              legalMoves = [];
              selected = null;
              render();
          }
          return; 
      }
      // ▲▲▲

      // ▼▼▼ ポイント消費（ここを追加） ▼▼▼
      if (typeof currentSkill.getCost === "function") {
          consumeSkillPoint(currentSkill.getCost());
      }

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

      // 通常の必殺技はフラグを立てる
      window.skillUsed = true; 
      skillUseCount++;

      // 履歴をリセットしてSFENモードへ
      usiHistory = [];

      if (endsTurn) {
          const kifuStr = result; 
          kifu.push(""); 
          kifu[kifu.length - 1] = kifuStr; 
          moveCount++;
          turn = (turn === "black" ? "white" : "black");
      } else {
          const movePart = result.split("：")[1] || result;
          lastSkillKifu = movePart;
      }
      
      lastMoveTo = null;
      if (moveSound) {
        moveSound.currentTime = 0;
        moveSound.play().catch(() => {});
      }

      // SFEN送信
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

  // 以下、通常の手番処理
  if (cpuEnabled && turn === cpuSide) return;

  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;
    const isWhite = piece === piece.toLowerCase();
    if ((turn === "black" && isWhite) || (turn === "white" && !isWhite)) return;
    selected = { x, y, fromHand: false, player: turn };
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

// script/yaneuraou_level.js の executeMove 関数

// script/yaneuraou_level.js の executeMove 関数

// script/yaneuraou_level.js の executeMove 関数（修正版）

function executeMove(sel, x, y, doPromote) {
  // ★重要：こちらが手を指した瞬間も、AIの先読みを止める
  if (typeof stopPondering === "function") stopPondering();

  // ▼▼▼ CPU必殺技（2回行動）の発動チェック ▼▼▼
  if (!gameOver && turn === cpuSide && !isCpuDoubleAction && typeof CpuDoubleAction !== 'undefined') {
      const cost = CpuDoubleAction.getCost();
      if (cpuSkillPoint >= cost) {
          consumeCpuSkillPoint(cost);
          isCpuDoubleAction = true;
          cpuSkillUseCount++;
          
          // ★重要：ここで必殺技モードON（SFENモードへ）
          window.skillUsed = true; 
          
          // ★修正1：履歴を空にして、強制的に「現在の盤面図」を読ませるようにする
          usiHistory = []; 

          // 演出
          playSkillEffect("boss_cutin.png", ["boss.mp3", "skill.mp3"], "dark"); 
          statusDiv.textContent = `CPUが必殺技【${CpuDoubleAction.name}】を発動！`;
          
          // 演出の時間分待ってから、本来の指し手を実行
          setTimeout(() => { executeMove(sel, x, y, doPromote); }, 1500);
          return; // ここで一旦処理を終了
      }
  }
  // ▲▲▲▲▲▲

  const pieceBefore = sel.fromHand ? hands[sel.player][sel.index] : boardState[sel.y][sel.x];
  
  // 履歴保存
  // 履歴保存
  history.push(deepCopyState());

  // ★★★ 追加：移動元の座標を記録 ★★★
  if (sel.fromHand) {
      lastMoveFrom = null;
  } else {
      lastMoveFrom = { x: sel.x, y: sel.y };
  }
  // ★★★★★★★★★★★★★★★★★★★★★

  const boardBefore = boardState.map(r => r.slice());
  const moveNumber = kifu.length + 1; 

  // 音再生
  if (moveSound) {
    moveSound.currentTime = 0;
    moveSound.volume = 0.3;
    moveSound.play().catch(() => {});
  }

  // --- 盤面の更新処理 ---
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
      // 成りエフェクト
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

  // --- 履歴の記録 ---
  const usiMove = convertToUsi(sel, x, y, doPromote, pieceBefore);
  
  // 必殺技モードのときはUSI履歴への追加は行わない
  if (!window.skillUsed) {
      usiHistory.push(usiMove);
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

  // 直前の指し手座標を更新
  lastMoveTo = { x, y };
  
  if (!isSimulating && turn !== cpuSide) {
    lastPlayerMove = {
      piece: pieceBefore.replace("+","").toUpperCase(),
      toX: x, toY: y
    };
  }

  // ▼▼▼ 2回行動時の処理（バグ修正済み） ▼▼▼
  if (isCpuDoubleAction) {
      isCpuDoubleAction = false; // フラグを下ろす
      
      // プレイヤーの番をスキップする演出（パスを記録）
      const playerRole = (turn === "black") ? "white" : "black";
      const mark = (playerRole === "black") ? "▲" : "△";
      kifu.push(`${kifu.length + 1}手目：${mark}パス(硬直)★`);
      moveCount++; 
      
      statusDiv.textContent = "必殺技の効果！ プレイヤーは行動できません！";
      
      // ★修正2：パスのときは「直前の指し手座標」を消す！
      // これをしないと、次の手が「同〇〇」と誤判定されてエラーになります
      lastMoveTo = null;

      selected = null;
      legalMoves = [];
      render(); 
      if (typeof showKifu === "function") showKifu();

      // ★重要：手番を交代せず（turnを変えず）、すぐに次の手を考えさせる
      if (!gameOver) setTimeout(() => { cpuMove(); }, 100);

  } else {
      // 通常の手番交代
      turn = turn === "black" ? "white" : "black";
      window.isCaptureRestricted = false;
      selected = null;
      legalMoves = [];
      render(); 
      if (typeof showKifu === "function") showKifu();
      if (!gameOver) startTimer();
      else stopTimer();
      moveCount++;
      
      // CPUの手番になったら思考開始
      if (turn === cpuSide && !gameOver) setTimeout(() => cpuMove(), 1000);
  }
  // ▲▲▲▲▲▲

  // ポイント計算
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
      if (captured !== "") {
          gain += getPoint(SP_CONFIG.CAPTURE, captured);
      }
      
      const isPlayerAction = (sel.player === "black" && cpuSide === "white") || (sel.player === "white" && cpuSide === "black");
      if (isPlayerAction) addSkillPoint(gain);
      else addCpuSkillPoint(gain);
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
  
  // CPUの手番なら押せない
  if (typeof cpuSide !== 'undefined' && turn === cpuSide) return;

  if (!currentSkill) return;
  if (isSkillTargeting) return;

  // ★修正：回数上限チェックを優先
  const max = currentSkill.maxUses || 1;
  const cost = (typeof currentSkill.getCost === "function") ? currentSkill.getCost() : 0;
  if (playerSkillPoint < cost) {
      alert(`ポイントが足りません (必要: ${cost}, 所持: ${Math.floor(playerSkillPoint)})`);
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
    
    // ボタンのスタイル適用
    if (currentSkill.buttonStyle) Object.assign(skillBtn.style, currentSkill.buttonStyle);
    else {
      skillBtn.style.backgroundColor = "#ff4500";
      skillBtn.style.color = "white";
      skillBtn.style.border = "none";
    }

    // ▼▼▼ ここから変更：コスト計算と有効化判定 ▼▼▼
    
    // 1. 必殺技のコストを取得
    let cost = 0;
    if (typeof currentSkill.getCost === "function") {
        cost = currentSkill.getCost();
    }
    
    // 2. 判定条件
    const canAfford = (playerSkillPoint >= cost); // ポイント足りてる？
    const isMyTurn = (typeof cpuSide === 'undefined') || (turn !== cpuSide); // 自分の番？
    const conditionMet = currentSkill.canUse(); // 盤面の条件（王手放置でないか等）OK？

    // 3. ボタンの状態更新
    if (canAfford && isMyTurn && conditionMet) {
       // 全部OKなら押せる
       skillBtn.disabled = false;
       skillBtn.style.opacity = 1.0;
       skillBtn.style.filter = "none";
    } else {
       // ダメなら押せない
       skillBtn.disabled = true;
       skillBtn.style.opacity = 0.6;
       
       // 特に「ポイント不足」の時は白黒（グレーアウト）にする演出
       if (!canAfford) skillBtn.style.filter = "grayscale(100%)";
       else skillBtn.style.filter = "none";
    }
    // ▲▲▲ ここまで変更 ▲▲▲

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
    boardTable.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red", "flash-blue", "flash-yellow");
    void boardTable.offsetWidth; 
    if (flashColor) boardTable.classList.add("flash-" + flashColor);
  }
}

// script/yaneuraou_level.js の cpuMove 関数をこれに書き換えてください

// AI思考ロジック
// AI思考ロジック
// script/yaneuraou_level.js の cpuMove をこれに書き換え

// AI思考ロジック（序盤短縮版）
function cpuMove() {
    if (gameOver) return;
    if (!isEngineReady) {
        statusDiv.textContent = "エンジン起動待ち...";
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

    let pvNum = currentLevelSetting.multiPV || 1;
    const isOddLevel = (currentLevelSetting.id % 2 !== 0);
    
    // 16手目までは、奇数レベルなら最低でも5手は読む
    if (isOddLevel && usiHistory.length <= 10) {
        if (pvNum < 20) pvNum =20;
    }
    
    sendToEngine(`setoption name MultiPV value ${pvNum}`);
    // ★追加：序盤の思考時間短縮ロジック
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
        sel = { x: fromX, y: fromY, fromHand: false, player: turn };
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
                        autoSkip: false,   // 勝手に省略しない
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
        if (latestScore > 200) evalElem.style.color = "red";       // 先手有利
        else if (latestScore < -200) evalElem.style.color = "blue"; // 後手有利
        else evalElem.style.color = "#333";                         // 互角
    }
}


// script/yaneuraou_level.js の startPondering をこれに書き換え

function startPondering() {
    if (gameOver || isPondering) return;
    
    // ★重要：Lv10未満（IDが10より小さい）は先読みしない
    if (currentLevelSetting.id < 10) return;

    let positionCmd = "";
    if (typeof window.skillUsed !== 'undefined' && window.skillUsed) {
        positionCmd = "position sfen " + generateSfen();
    } else {
        positionCmd = "position startpos moves " + usiHistory.join(" ");
    }
    sendToEngine(positionCmd);
    
    // 先読み時はMultiPVは1でOK（全力で最善を読むため）
    sendToEngine("setoption name MultiPV value 1");
    sendToEngine("go infinite");
    
    isPondering = true;
    statusDiv.textContent = "「次、どうくるかな…？（先読み中）」";
    
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

// ★★★ グラフエリアの表示/非表示（モーダル対応版） ★★★
function toggleGraph() {
    const area = document.getElementById("graphArea");
    if (!area) return;

    if (area.style.display === "none") {
        area.style.display = "flex"; // モーダルとして表示
        // 表示された瞬間にグラフを再描画してサイズを合わせる
        if (evalChart) {
            setTimeout(() => {
                evalChart.resize();
                updateChart();
            }, 50);
        }
    } else {
        area.style.display = "none";
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
    if (range <= 500) return 100;   // ±500なら100刻み
    if (range <= 1000) return 200;  // ±1000なら200刻み
    if (range <= 2000) return 500;  // ±2000なら500刻み
    if (range <= 5000) return 1000; // ±5000なら1000刻み
    return 2000;                    // ±10000なら2000刻み
}

// ★★★ 棋譜エリアの表示/非表示を切り替える ★★★
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
    
    // ★修正：自分が投了したので、勝者は「相手（cpuSide）」になる
    winner = cpuSide; 
    
    // Firebaseに結果を保存
    saveGameResult(winner);
    // ...
    
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
// script/yaneuraou_level.js の saveGameResult 関数をこれに書き換え

function saveGameResult(res) {
    const user = auth.currentUser; // Firebaseのログインユーザーを確認
    if (!user) {
        console.log("未ログインのため、記録は保存されません。");
        return; 
    }

    // ★修正：現在のレベル設定から名前を取得して、相手の名前にする
    // currentLevelSetting.name には "Lv1" や "Lv50" などが入っています
    const levelName = currentLevelSetting ? currentLevelSetting.name : "Lv?";
    const opponentDisplayName = `CPU ${levelName}`; // 記録される名前（例: "CPU Lv1"）
    
    // あなた（先手/black）が勝ったかどうか
    // AIの手番(cpuSide)が "white" なら、プレイヤーは "black"
    const playerColor = (cpuSide === "white" ? "black" : "white");
    const isWin = (res === playerColor);
    
    // 保存するデータのカタマリを作成
    const gameRecord = {
        date: new Date(),                // 対局日時
        opponent: opponentDisplayName,   // 相手の名前 (ここでCPUのレベルが入る)
        moves: moveCount,                // 合計手数
        result: isWin ? "WIN" : "LOSE",  // 勝敗
        mode: "yaneuraou", 
        kifuData: kifu                   // 記録された指し手（配列）
    };

    if (typeof updateMissionProgress === "function") {
        // 1. 「対局する」ミッションの進行 (+1回)
        updateMissionProgress("play", 1);

        // 2. 「勝利する」ミッションの進行 (勝った場合のみ +1回)
        if (isWin) {
            updateMissionProgress("win", 1);
        }
    }

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
// script/yaneuraou_main.js の末尾に追加

// ★★★ 駒台の左右を入れ替える関数 ★★★


function updateHandLayout(playerRole) {
    const leftSide = document.querySelector(".side.left");
    const rightSide = document.querySelector(".side.right");
    const blackBox = document.getElementById("blackHandBox");
    const whiteBox = document.getElementById("whiteHandBox");

    if (!leftSide || !rightSide || !blackBox || !whiteBox) return;

    if (playerRole === "white") {
        // --- プレイヤーが後手の場合 ---
        
        // クラスを入れ替えて背景画像を交代させる
        blackBox.classList.remove("black-hand");
        blackBox.classList.add("white-hand"); // CPU(先手)だけど画像は2P用にする

        whiteBox.classList.remove("white-hand");
        whiteBox.classList.add("black-hand"); // 自分(後手)だけど画像は1P用にする

        // 配置の入れ替え
        leftSide.prepend(blackBox);
        rightSide.appendChild(whiteBox);
    } else {
        // --- プレイヤーが先手の場合（通常） ---
        
        blackBox.classList.remove("white-hand");
        blackBox.classList.add("black-hand");

        whiteBox.classList.remove("black-hand");
        whiteBox.classList.add("white-hand");

        // 配置の入れ替え
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
        // 必要に応じて skillUseCount も保存・復元対象に含めることができます
    };
}

// ★★★ 着せ替え反映用関数 ★★★
function applyUserSkin() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    db.collection("users").doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const equipped = data.equipped || {};
            
            if (typeof GAME_ITEMS !== 'undefined') {
                // --- 駒の反映 ---
                if (equipped.piece) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.piece);
                    if (item && item.image) {
                        document.documentElement.style.setProperty('--piece-img', `url('${item.image}')`);
                    }
                }
                // --- 盤の反映 ---
                if (equipped.board) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.board);
                    if (item && item.image) {
                        document.documentElement.style.setProperty('--board-img', `url('${item.image}')`);
                    }
                }
                
                // --- ★★★ 追加：BGMの反映 ★★★ ---
                if (equipped.bgm) {
                    const item = GAME_ITEMS.find(i => i.id === equipped.bgm);
                    // アイテムが存在し、かつ src プロパティがある場合
                    if (item && item.src) {
                        const bgmEl = document.getElementById("bgm");
                        if (bgmEl) {
                            // 現在再生中のソースと違う場合のみ変更（リロード防止）
                            // ※パスの比較は完全一致しないことがあるので、ファイル名が含まれるかで判定するなど工夫してもOK
                            // ここでは単純に上書きします
                            bgmEl.src = item.src;
                            
                            // 画面ロード時に自動再生させたい場合はここでも play() を呼ぶことができますが、
                            // 通常は「対局開始」等のタイミングで playBGM() が呼ばれるので、srcを変えるだけでOKです。
                        }
                    }
                }
            }
        }
    }).catch(console.error);
}

// ▼▼▼ このコードをファイルの「一番最後」に追加してください ▼▼▼

// --- ゲージ管理用の関数群 ---

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



















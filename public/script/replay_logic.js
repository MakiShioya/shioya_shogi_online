// ==========================================
// replay_logic.js - スナップショット方式（完全解決版）
// ==========================================

// --- グローバル変数 ---
let replayStates = [];
let currentStep = 0;
let lastMoveInfo = { from: null, to: null };

// --- エンジン・グラフ用変数 ---
let evalHistory = [];
let evalChart = null;
let isEngineReady = false;
let isWaitingRecommendation = false;
let analysisResolver = null;

// ★重要: 解析コンテキスト管理（スナップショット）
// エンジンが現在処理しているタスクの「正解情報（手数・手番）」をここに保持する
// グローバル変数（currentStepなど）は見ない。
let currentAnalysisId = 0;
let processingAnalysisId = 0;
let analysisContexts = {}; // IDごとの情報を保存する辞書

// --- 全自動検討・おすすめ用の変数 ---
let isAutoAnalyzing = false;
let autoAnalysisTimer = null;
let recommendedMove = null;
let recommendTimer = null;

// --- 好手（Discovery）検知用変数 ---
let discoveryFlags = [];
let matchFlags = [];
let lastBestMoveAt1s = null;
let searchStartTime = 0;

const kanjiToNum = { "一": 0, "二": 1, "三": 2, "四": 3, "五": 4, "六": 5, "七": 6, "八": 7, "九": 8 };
const zenkakuToNum = { "１": 0, "２": 1, "３": 2, "４": 3, "５": 4, "６": 5, "７": 6, "８": 7, "９": 8 };
const pieceMap = { "歩": "P", "香": "L", "桂": "N", "銀": "S", "金": "G", "角": "B", "飛": "R", "玉": "K", "王": "K" };
const skillImageMap = { "(応援)": "PassionateSupport.PNG", "(計画)": "BluePrint.PNG", "★": "SilverArmor.PNG" };

/**
 * 1. 起動時の初期化
 */
window.addEventListener("DOMContentLoaded", () => {
    initChart();
    if (typeof initEngine === 'function') {
        initEngine();
        setTimeout(() => { sendToEngine("usi"); }, 500);
    }
    const savedKifu = sessionStorage.getItem("replayKifu");
    if (savedKifu) {
        const area = document.getElementById("kifuInputArea");
        if (area) {
            area.value = savedKifu;
            setTimeout(() => { loadKifu(); sessionStorage.removeItem("replayKifu"); }, 200);
        }
    }
});

function formatSeconds(totalSeconds) {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return min > 0 ? `${min}分${sec}秒` : `${sec}秒`;
}

// 棋譜の手を取得（引数で指定されたstepの手を取得する）
function getKifuMoveUsi(step) {
    const nextState = replayStates[step + 1];
    if (!nextState || !nextState.lastMove || !nextState.lastMove.to) return null;
    
    const m = nextState.lastMove;
    const toStr = (9 - m.to.x) + String.fromCharCode(97 + m.to.y);
    
    if (!m.from) { 
        const piece = nextState.boardState[m.to.y][m.to.x].replace("+", "").toUpperCase();
        return piece + "*" + toStr;
    } else {
        const fromStr = (9 - m.from.x) + String.fromCharCode(97 + m.from.y);
        const prevPiece = replayStates[step].boardState[m.from.y][m.from.x];
        const nextPiece = nextState.boardState[m.to.y][m.to.x];
        const isPromotion = !prevPiece.startsWith("+") && nextPiece.startsWith("+");
        return fromStr + toStr + (isPromotion ? "+" : "");
    }
}

/**
 * 2. エンジン通信 & 解析ロジック
 */

function sendToEngine(msg) {
    if (typeof engineWorker !== 'undefined' && engineWorker) engineWorker.postMessage(msg);
}

function generateSfen() {
    if (typeof convertBoardToSFEN === 'function') {
        return convertBoardToSFEN(boardState, hands, window.turn, currentStep);
    }
    return "startpos";
}

// 解析リクエスト発行
function analyzeCurrentPosition() {
    if (!isEngineReady) return;
    
    // 新しいIDを発行し、そのIDで実行したい内容（コンテキスト）を保存
    currentAnalysisId++;
    analysisContexts[currentAnalysisId] = {
        step: currentStep,
        turn: window.turn,
        type: 'normal'
    };

    sendToEngine("stop");    
    sendToEngine("isready"); 
}

// おすすめ機能リクエスト
function getRecommendation() {
    if (!isEngineReady) return alert("エンジンが準備中です。");
    
    recommendedMove = null; 
    render();
    
    const btn = document.getElementById("recommendBtn");
    if(btn) {
        btn.disabled = true;
        btn.textContent = "準備中...";
    }

    currentAnalysisId++;
    // コンテキストにおすすめモードであることを記録
    analysisContexts[currentAnalysisId] = {
        step: currentStep,
        turn: window.turn,
        type: 'recommend'
    };
    
    sendToEngine("stop");
    sendToEngine("isready");
}

// エンジンに実際の計算を開始させる
function startRealAnalysis() {
    // 現在処理するIDを更新
    processingAnalysisId = currentAnalysisId;
    
    // コンテキストを取得
    const ctx = analysisContexts[processingAnalysisId];
    if (!ctx) return; // 万が一なければ終了

    searchStartTime = Date.now();
    lastBestMoveAt1s = null;

    const sfen = generateSfen(); // ※generateSfenは現在のglobal stateを見るが、同期が取れている前提

    if (ctx.type === 'recommend') {
        isWaitingRecommendation = true;
        sendToEngine("position sfen " + sfen);
        sendToEngine("go movetime 5000"); 
        
        let timeLeft = 5;
        const btn = document.getElementById("recommendBtn");
        if(btn) btn.textContent = `考え中… ${timeLeft}`;
        if (recommendTimer) clearInterval(recommendTimer);
        recommendTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                if(btn) btn.textContent = `考え中… ${timeLeft}`;
            } else {
                clearInterval(recommendTimer);
            }
        }, 1000);

    } else {
        isWaitingRecommendation = false;
        if (recommendTimer) clearInterval(recommendTimer);
        const btn = document.getElementById("recommendBtn");
        if(btn) {
             btn.textContent = "おすすめ";
             btn.disabled = false;
        }
        sendToEngine("position sfen " + sfen);
        sendToEngine("go movetime 100000"); 
    }
}

function handleEngineMessage(msg) {
    if (msg === "usiok") sendToEngine("isready");
    
    else if (msg === "readyok") {
        isEngineReady = true;
        if (currentAnalysisId > processingAnalysisId) {
            startRealAnalysis();
        } 
        else if (!isAutoAnalyzing && processingAnalysisId === 0) {
             // 初回起動時など
             analyzeCurrentPosition();
        }
    }

    if (typeof msg === "string") {
        
        // ★最重要修正: グローバル変数ではなく、IDに紐付いた「コンテキスト」を取得する
        // processingAnalysisId は「今エンジンが計算しているID」を指している
        const ctx = analysisContexts[processingAnalysisId];
        
        // コンテキストが存在しない、または極端に古いIDの残骸なら無視
        // (ただし、今回はID管理しているので processingAnalysisId は信頼できる)
        if (!ctx) return;

        // 1秒時点の候補手サンプリング
        if (msg.includes("info") && msg.includes("pv")) {
            const elapsed = Date.now() - searchStartTime;
            if (elapsed <= 1000) {
                const parts = msg.split(" ");
                const pvIdx = parts.indexOf("pv");
                if (pvIdx !== -1 && parts[pvIdx + 1]) {
                    lastBestMoveAt1s = parts[pvIdx + 1];
                }
            }
        }

        // --- bestmove受信 ---
        if (msg.startsWith("bestmove")) {
            const parts = msg.split(" ");
            const usiMove = parts[1];
            
            // ★コンテキスト内の step を使って正解手を取得（これでズレない！）
            const kifuMoveUsi = getKifuMoveUsi(ctx.step);
            
            // フラグ更新
            if (lastBestMoveAt1s && usiMove !== lastBestMoveAt1s && usiMove === kifuMoveUsi) {
                discoveryFlags[ctx.step + 1] = true; 
            }
            if (usiMove === kifuMoveUsi) {
                matchFlags[ctx.step + 1] = true;
            }
            
            // グラフ更新（青丸などを反映）
            updateChart();

            // おすすめ機能完了処理
            if (ctx.type === 'recommend') {
                isWaitingRecommendation = false;
                const btn = document.getElementById("recommendBtn");
                if (btn) {
                    btn.textContent = "おすすめ";
                    btn.disabled = false;
                }
                if (usiMove !== "resign" && usiMove !== "(none)") {
                    let toX, toY, fromX = null, fromY = null, pieceChar;
                    if (usiMove.includes("*")) {
                        pieceChar = usiMove[0];
                        toX = 9 - parseInt(usiMove[2]);
                        toY = usiMove[3].charCodeAt(0) - 97;
                    } else {
                        fromX = 9 - parseInt(usiMove[0]);
                        fromY = usiMove[1].charCodeAt(0) - 97;
                        toX = 9 - parseInt(usiMove[2]);
                        toY = usiMove[3].charCodeAt(0) - 97;
                        // 注意: boardStateは現在のものを使うしかないが、おすすめ時は画面も止まっているはず
                        const targetPiece = boardState[fromY][fromX]; 
                        if (targetPiece) pieceChar = targetPiece.replace("+", "").toUpperCase();
                    }
                    recommendedMove = { x: toX, y: toY, fromX: fromX, fromY: fromY, name: pieceName[pieceChar] || pieceChar };
                    render();
                }
            }
        }

        const isMate = msg.includes("score mate");
        if (isMate && isAutoAnalyzing && analysisResolver) {
            analysisResolver();
            analysisResolver = null;
        }

        if (msg.includes("score cp") || msg.includes("score mate")) {
            const parts = msg.split(" ");
            let rawScore = 0;

            if (msg.includes("score cp")) {
                rawScore = parseInt(parts[parts.indexOf("cp") + 1]);
            } else if (msg.includes("score mate")) {
                const mateIndex = parts.indexOf("mate");
                const mateStr = parts[mateIndex + 1]; 
                const m = parseInt(mateStr);

                if (mateStr.startsWith("-") || mateStr === "0" || m === 0) {
                    rawScore = -30000 - Math.abs(m); 
                } else {
                    rawScore = 30000 - Math.abs(m);
                }
            }
            
            // ★コンテキスト内の turn を使って反転判定（これで絶対にズレない！）
            if (ctx.turn === "white") {
                rawScore = -rawScore;
            }

            // ★コンテキスト内の step に書き込む
            if (ctx.step !== -1) {
                evalHistory[ctx.step] = rawScore;
                updateChart();
            }
        }
    }
}

/**
 * 3. 棋譜解析
 */
function loadKifu() {
    const text = document.getElementById("kifuInputArea").value;
    if (!text) return alert("棋譜を入力してください");
    if (typeof initBoard === "function") initBoard(); 
    replayStates = [];
    evalHistory = [0]; 
    discoveryFlags = [false]; 
    matchFlags = [false];
    replayStates.push(JSON.parse(JSON.stringify({ boardState, hands, turn: "black", lastMove: { from: null, to: null }, skillImage: null })));

    const lines = text.split(/\n/).filter(l => l.includes("手目："));
    let lastTo = null;
    try {
        lines.forEach((line) => {
            const nextState = parseAndApplyLine(line, lastTo);
            replayStates.push(nextState);
            evalHistory.push(undefined); 
            discoveryFlags.push(false);
            matchFlags.push(false);
            lastTo = nextState.lastMove.to;
        });
        currentStep = 0;
        applyState(replayStates[0]);
    } catch (e) { alert("解析エラー: " + e.message); }
}

function parseAndApplyLine(line, lastTo) {
    const isBlack = line.includes("▲");
    const turnColor = isBlack ? "black" : "white";
    let content = line.split("：")[1] || line;
    let skillImage = null;
    if (line.includes("(応援)")) skillImage = skillImageMap["(応援)"];
    else if (line.includes("(計画)")) skillImage = skillImageMap["(計画)"];
    else if (line.includes("★")) skillImage = skillImageMap["★"];

    const actions = content.split("，");
    let finalFrom = null, finalTo = null;
    actions.forEach((action) => {
        const result = executeAction(action, turnColor, lastTo);
        if (result.to) { finalFrom = result.from; finalTo = result.to; lastTo = result.to; }
    });
    return JSON.parse(JSON.stringify({ boardState, hands, turn: isBlack ? "white" : "black", lastMove: { from: finalFrom, to: finalTo }, skillImage: skillImage }));
}

function executeAction(action, turnColor, lastTo) {
    let fromX = null, fromY = null, toX = null, toY = null;
    if (action.includes("同")) { toX = lastTo.x; toY = lastTo.y; }
    else {
        const f = action.match(/[１-９]/), r = action.match(/[一二三四五六七八九]/);
        if (f && r) { toX = 9 - (Object.keys(zenkakuToNum).indexOf(f[0]) + 1); toY = kanjiToNum[r[0]]; }
    }
    const pm = action.match(/[歩香桂銀金角飛玉王]/);
    if (!pm) return { from: null, to: null };
    const pt = pieceMap[pm[0]], isDrop = action.includes("打"), isInPlace = action.includes("(応援)") || action.includes("(計画)"), fc = action.match(/\((\d)(\d)\)/);

    if (isDrop) {
        const idx = hands[turnColor].indexOf(pt);
        if (idx !== -1) hands[turnColor].splice(idx, 1);
        boardState[toY][toX] = (turnColor === "white") ? pt.toLowerCase() : pt;
    } else if (isInPlace) {
        let p = boardState[toY][toX];
        if (p && action.includes("成")) { p = "+" + p.replace("+", "").toUpperCase(); boardState[toY][toX] = (turnColor === "white") ? p.toLowerCase() : p; }
        fromX = toX; fromY = toY;
    } else if (fc) {
        fromX = 9 - parseInt(fc[1]); fromY = parseInt(fc[2]) - 1;
        let p = boardState[fromY][fromX];
        boardState[fromY][fromX] = "";
        if (action.includes("成")) { p = "+" + p.replace("+", "").toUpperCase(); if (turnColor === "white") p = p.toLowerCase(); }
        const target = boardState[toY][toX];
        if (target) hands[turnColor].push(target.replace("+", "").toUpperCase());
        boardState[toY][toX] = p;
    }
    return { from: (fromX !== null ? {x: fromX, y: fromY} : null), to: {x: toX, y: toY} };
}

/**
 * 4. 描画
 */
function applyState(state) {
    recommendedMove = null; 
    boardState = JSON.parse(JSON.stringify(state.boardState));
    hands = JSON.parse(JSON.stringify(state.hands));
    window.turn = state.turn;
    lastMoveInfo = state.lastMove || { from: null, to: null };

    if (state.skillImage) playReplayCutIn(state.skillImage);
    else { 
        const img = document.getElementById("skillCutIn"); 
        if (img) img.classList.remove("cut-in-active"); 
    }

    render();
    updateUI();

    if (!isAutoAnalyzing) {
        if (evalHistory[currentStep] === undefined) {
            analyzeCurrentPosition();
        } else {
            // 計算済みなら、IDを新しくして(古い受信を無効化しつつ)止める
            currentAnalysisId++;
            sendToEngine("stop");
            updateChart(); 
        }
    }
}

// --- 修正版 render 関数 ---
function render() {
    const bt = document.getElementById("board");
    if (!bt) return;
    bt.innerHTML = "";

    for (let y = 0; y < 9; y++) {
        const tr = document.createElement("tr");
        for (let x = 0; x < 9; x++) {
            const td = document.createElement("td");
            const p = boardState[y][x]; 
            
            let displayPiece = p;
            let isRecommendation = false;

            if (recommendedMove && recommendedMove.x === x && recommendedMove.y === y) {
                isRecommendation = true;
            }

            if (displayPiece || isRecommendation) {
                const isW = displayPiece === displayPiece.toLowerCase() && displayPiece !== "";
                const key = displayPiece.startsWith("+") ? "+" + displayPiece.replace("+","").toUpperCase() : displayPiece.toUpperCase();
                
                let charText = (typeof pieceName !== 'undefined' && pieceName[key]) ? pieceName[key] : key;
                if (isRecommendation) charText = recommendedMove.name;

                const container = document.createElement("div");
                container.className = "piece-container";

                if (!isRecommendation && displayPiece !== "") {
                    const baseType = displayPiece.replace("+", "").toUpperCase();
                    container.classList.add("size-" + baseType);
                }

                if (isW) {
                    container.classList.add("gote");
                }

                const textSpan = document.createElement("span");
                textSpan.className = "piece-text";
                if (key.startsWith("+")) textSpan.classList.add("promoted");
                
                textSpan.textContent = charText;

                if (isRecommendation) {
                    td.classList.add("recommended-cell");
                    textSpan.style.color = "#007bff"; 
                    textSpan.style.fontWeight = "bold"; 
                    textSpan.style.textShadow = "1px 1px 0px #fff"; 
                    if (window.turn === "white") {
                        container.classList.add("gote");
                        td.style.transform = "rotate(180deg)";
                    }
                } else if (isW) {
                    td.style.transform = "rotate(180deg)";
                }

                container.appendChild(textSpan);
                td.appendChild(container);
            }

            if (lastMoveInfo.from && lastMoveInfo.from.x === x && lastMoveInfo.from.y === y) {
                td.classList.add("move-from");
            }
            if (lastMoveInfo.to && lastMoveInfo.to.x === x && lastMoveInfo.to.y === y) {
                td.classList.add("move-to");
            }

            tr.appendChild(td);
        }
        bt.appendChild(tr);
    }
    renderHands();
    setTimeout(drawRecommendationArrow, 10);
}

// --- 修正版 renderHands 関数 ---
function renderHands() {
    const bh = document.getElementById("blackHand"), wh = document.getElementById("whiteHand");
    if (!bh || !wh) return;

    const order = ["P", "L", "N", "S", "G", "B", "R", "K"]; 
    
    hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    bh.innerHTML = "";
    wh.innerHTML = "";

    const createHandPiece = (player, p) => {
        const container = document.createElement("div");
        container.className = "hand-piece-container";

        if (player === "white") {
            container.classList.add("gote");
            container.style.transform = "rotate(180deg)";
        }

        const textSpan = document.createElement("span");
        textSpan.className = "piece-text";
        textSpan.textContent = (typeof pieceName !== 'undefined') ? pieceName[p] : p;

        container.appendChild(textSpan);
        return container;
    };

    hands.black.forEach(p => {
        bh.appendChild(createHandPiece("black", p));
    });

    hands.white.forEach(p => {
        wh.appendChild(createHandPiece("white", p));
    });
}

function playReplayCutIn(imageName) {
    const img = document.getElementById("skillCutIn");
    if (!img) return;
    img.src = "script/image/" + imageName;
    img.classList.remove("cut-in-active");
    void img.offsetWidth;
    img.classList.add("cut-in-active");
}

/**
 * 5. グラフ
 */
function initChart() {
    const ctx = document.getElementById('evalChart').getContext('2d');
    if (evalChart) evalChart.destroy();
    evalChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ 
            data: evalHistory, 
            borderColor: '#ff4500', 
            backgroundColor: 'rgba(255, 69, 0, 0.1)', 
            fill: true, 
            tension: 0.3,
            // 1. 点の形（好手なら星、それ以外は丸）
            pointStyle: (ctx) => discoveryFlags[ctx.dataIndex] ? 'star' : 'circle',

            // 2. 点の大きさ（好手=10、一致=5、通常=2）
            pointRadius: (ctx) => discoveryFlags[ctx.dataIndex] ? 10 : (matchFlags[ctx.dataIndex] ? 3 : 2),

            // 3. 点の色（好手=金、一致=青、通常=赤）
            pointBackgroundColor: (ctx) => {
                if (discoveryFlags[ctx.dataIndex]) return '#ffd700'; // 金色
                if (matchFlags[ctx.dataIndex]) return '#1e90ff';     // 青色
                return '#ff4500';                                    // 赤色
            },

    // 4. 点の枠線色（好手=濃い金、一致=濃い青、通常=赤）
    pointBorderColor: (ctx) => discoveryFlags[ctx.dataIndex] ? '#b8860b' : (matchFlags[ctx.dataIndex] ? '#0000cd' : '#ff4500'),

    // 5. 枠線の太さ（好手と一致は強調する）
    pointBorderWidth: (ctx) => (discoveryFlags[ctx.dataIndex] || matchFlags[ctx.dataIndex]) ? 2 : 1
        }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { min: -1000, max: 1000 }, x: { type: 'category', grid: { display: false } } },
            plugins: { 
                legend: { display: false },
                zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } }
            },
            onClick: (e, elements) => { if (elements.length > 0) { currentStep = elements[0].index; applyState(replayStates[currentStep]); } }
        },
        plugins: [{
            id: 'currentStepLine',
            afterDraw: (chart) => {
                if (currentStep < 0 || currentStep >= chart.data.labels.length) return;
                const ctx = chart.ctx, xAxis = chart.scales.x, yAxis = chart.scales.y;
                const xPos = xAxis.getPixelForValue(chart.data.labels[currentStep]);
                if (isNaN(xPos)) return;
                ctx.save();
                ctx.beginPath(); ctx.moveTo(xPos, yAxis.top); ctx.lineTo(xPos, yAxis.bottom);
                ctx.lineWidth = 2; ctx.strokeStyle = 'red'; ctx.setLineDash([5, 3]); ctx.stroke();
                ctx.restore();
            }
        }]
    });
}

function resetChartZoom() { if (evalChart) evalChart.resetZoom(); }

function updateChart() {
    if (!evalChart) return;
    
    // グラフデータの更新
    evalChart.data.labels = replayStates.map((_, i) => i.toString());
    evalChart.data.datasets[0].data = evalHistory.map((score, i) => {
        if (score === undefined) return null;

        // ★修正ポイント: しきい値を下げて、詰み関連のスコアをすべて一定値に丸める
        if (score > 20000) return 10000;
        if (score < -20000) return -10000;

        return score;
    });
    evalChart.update();

    // 数値評価（テキスト）の更新
    const currentScore = evalHistory[currentStep];

    const evalElem = document.getElementById("numericEval");
    if (evalElem && currentScore !== undefined) {
        if (Math.abs(currentScore) >= 20000) {
            // Mateスコアの処理
            const winner = currentScore > 0 ? "先手" : "後手";
            evalElem.textContent = `評価値: ${winner}勝ち`;
        } else {
            // 通常スコア（勝率換算付き）
            const wr = (1 / (1 + Math.exp(-currentScore / 1200)) * 100).toFixed(1);
            evalElem.textContent = `評価値: ${currentScore > 0 ? "+" : ""}${currentScore} (勝率: ${wr}%)`;
        }
    }
}

function updateChartSettings() {
    if (!evalChart) return;
    const scaleVal = document.getElementById("scaleSelect").value;
    const yAxis = evalChart.options.scales.y;
    if (scaleVal === "auto") { delete yAxis.min; delete yAxis.max; }
    else { const val = parseInt(scaleVal); yAxis.min = -val; yAxis.max = val; }
    updateChart();
}

/**
 * 6. オート検討（★修正: ループ内でのID更新）
 */
async function startAutoAnalysis(timePerMove) {
    const n = replayStates.length - 1;
    if (n <= 10) return alert("この棋譜は短すぎます。全自動モードには11手以上の棋譜が必要です。");
    let maxSeconds = (timePerMove === 1000) ? n : (timePerMove === 5000 ? 20 + 5*(n-10) : 20 + 10*(n-10));
    const isConfirmed = await showCustomConfirm(`全自動モードを開始します。\n最大予測時間：${formatSeconds(maxSeconds)}\n解析を開始してもよろしいですか？`);
    if (!isConfirmed) return; 

    if (isAutoAnalyzing) stopAutoAnalysis();
    isAutoAnalyzing = true;
    document.getElementById("stopAutoBtn").style.display = "inline-block";
    for (let i = currentStep; i < replayStates.length; i++) {
        if (!isAutoAnalyzing) break;
        currentStep = i; analyzingStep = i; 
        analyzingTurn = replayStates[i].turn;
        
        applyState(replayStates[i]);
        
        // ★重要: ここでも analyzeCurrentPosition を呼ぶことでIDを発行・管理させる
        analyzeCurrentPosition();

        let effectiveTime = (i <= 10 && timePerMove > 2000) ? 2000 : timePerMove;
        
        await new Promise(resolve => {
            analysisResolver = resolve;
            autoAnalysisTimer = setTimeout(() => { if (analysisResolver === resolve) { analysisResolver(); analysisResolver = null; } }, effectiveTime);
        });
    }
    stopAutoAnalysis();
}

function stopAutoAnalysis() {
    isAutoAnalyzing = false;
    if (autoAnalysisTimer) { clearTimeout(autoAnalysisTimer); autoAnalysisTimer = null; }
    const btn = document.getElementById("stopAutoBtn");
    if (btn) btn.style.display = "none";
    analyzeCurrentPosition(); 
}

function nextStep() { if (currentStep < replayStates.length - 1) { currentStep++; applyState(replayStates[currentStep]); } }
function prevStep() { if (currentStep > 0) { currentStep--; applyState(replayStates[currentStep]); } }
function goToStart() { currentStep = 0; applyState(replayStates[0]); }
function goToEnd() { currentStep = replayStates.length - 1; applyState(replayStates[currentStep]); }
function seekMove(val) { currentStep = parseInt(val); applyState(replayStates[currentStep]); }

function updateUI() {
    const st = document.getElementById("status");
    const totalSteps = replayStates.length - 1;
    if (st) st.textContent = (currentStep === 0) ? "開始局面" : `${currentStep} / ${totalSteps}手目`;
}

function drawRecommendationArrow() {
    const svg = document.getElementById("arrow-layer");
    if (!svg || !recommendedMove || recommendedMove.fromX === null) { if(svg) svg.innerHTML = ""; return; }
    svg.innerHTML = "";
    const board = document.getElementById("board");
    const fromCell = board.rows[recommendedMove.fromY].cells[recommendedMove.fromX];
    const toCell = board.rows[recommendedMove.y].cells[recommendedMove.x];
    const getCenter = (el) => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 });
    const start = getCenter(fromCell), end = getCenter(toCell);
    svg.innerHTML = `
        <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="rgba(30, 144, 255, 0.8)" /></marker></defs>
        <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="rgba(30, 144, 255, 0.6)" stroke-width="6" marker-end="url(#arrowhead)" />`;
}

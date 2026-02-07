// ==========================================
// replay_logic.js - 徹底捜査モード（SFEN確認）
// ==========================================

// --- グローバル変数 ---
let replayStates = [];
let currentStep = 0;
let lastMoveInfo = { from: null, to: null };

// --- エンジン・グラフ用変数 ---
let evalHistory = [];
let evalChart = null;
let isEngineReady = false;
let analyzingStep = -1;
let analyzingTurn = "black";
let isWaitingRecommendation = false;
let analysisResolver = null;

// --- 捜査用フラグ ---
let isEngineIdle = true; 

// --- その他変数 ---
let isAutoAnalyzing = false;
let autoAnalysisTimer = null;
let recommendedMove = null;
let discoveryFlags = [];    
let matchFlags = [];        
let lastBestMoveAt1s = null; 
let searchStartTime = 0;    

const kanjiToNum = { "一": 0, "二": 1, "三": 2, "四": 3, "五": 4, "六": 5, "七": 6, "八": 7, "九": 8 };
const zenkakuToNum = { "１": 0, "２": 1, "３": 2, "４": 3, "５": 4, "６": 5, "７": 6, "８": 7, "９": 8 };
const pieceMap = { "歩": "P", "香": "L", "桂": "N", "銀": "S", "金": "G", "角": "B", "飛": "R", "玉": "K", "王": "K" };
const skillImageMap = { "(応援)": "PassionateSupport.PNG", "(計画)": "BluePrint.PNG", "★": "SilverArmor.PNG" };

// 初期化
window.addEventListener("DOMContentLoaded", () => {
    initChart();
    if (typeof initEngine === 'function') {
        initEngine();
        isEngineIdle = false; 
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

// SFEN生成（★ここが最重要捜査ポイント★）
function generateSfen() {
    let sfen = "startpos";
    if (typeof convertBoardToSFEN === 'function') {
        sfen = convertBoardToSFEN(boardState, hands, window.turn, currentStep);
    }
    
    // SFENの全文をログに出力して、盤面が本当に切り替わっているか監視する
    if (analyzingStep >= 140) {
        console.log(`%c[SFEN_CHECK] Step:${currentStep} | Turn:${window.turn}`, "background: #ddd; color: blue; font-weight: bold;");
        console.log(`%c${sfen}`, "color: gray; font-size: 0.9em;");
    }
    
    return sfen;
}

function analyzeCurrentPosition() {
    if (!isEngineReady) return;
    isEngineIdle = false; 
    sendToEngine("stop");    
    sendToEngine("isready"); 
}

function startRealAnalysis() {
    isEngineIdle = false; 
    searchStartTime = Date.now();
    lastBestMoveAt1s = null;
    analyzingStep = currentStep;
    analyzingTurn = window.turn; 

    // ★追加捜査: メモリキャッシュ（ハッシュ）が悪さをしていないか確認するため
    // Stepが進むたびに newgame を送って脳をリセットさせてみる
    // （※これが原因なら、これで直る可能性があります）
    // sendToEngine("ucinewgame"); 

    const sfen = generateSfen();
    sendToEngine("position sfen " + sfen);
    sendToEngine("go movetime 100000"); 
}

function handleEngineMessage(msg) {
    if (msg === "usiok") {
        sendToEngine("isready");
    } else if (msg === "readyok") {
        isEngineReady = true;
        isEngineIdle = true; 
        if (!isAutoAnalyzing) {
             startRealAnalysis();
        }
    }

    if (typeof msg === "string") {
        if (isEngineIdle) return;

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

        if (msg.startsWith("bestmove")) {
            const parts = msg.split(" ");
            const usiMove = parts[1];
            const kifuMoveUsi = getKifuMoveUsi(analyzingStep);
            
            if (lastBestMoveAt1s && usiMove !== lastBestMoveAt1s && usiMove === kifuMoveUsi) {
                discoveryFlags[analyzingStep + 1] = true; 
            }
            if (usiMove === kifuMoveUsi) {
                matchFlags[analyzingStep + 1] = true;
            }

            if (isWaitingRecommendation) {
                isWaitingRecommendation = false;
                const btn = document.getElementById("recommendBtn");
                if (btn) btn.disabled = false;
                if (usiMove !== "resign" && usiMove !== "(none)") {
                    // おすすめ処理省略（長いので）
                    recommendedMove = { x: 0, y: 0, fromX: 0, fromY: 0, name: "" }; // ダミー
                    // 本来の処理が必要ならここに戻す
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
            let debugType = "CP";

            if (msg.includes("score cp")) {
                rawScore = parseInt(parts[parts.indexOf("cp") + 1]);
            } else if (msg.includes("score mate")) {
                debugType = "MATE";
                const mateIndex = parts.indexOf("mate");
                const mateStr = parts[mateIndex + 1]; 
                const m = parseInt(mateStr);
                if (mateStr.startsWith("-") || mateStr === "0" || m === 0) {
                    rawScore = -30000 - Math.abs(m); 
                } else {
                    rawScore = 30000 - Math.abs(m);
                }
            }
            
            let finalScore = rawScore;
            if (typeof analyzingTurn !== 'undefined' && analyzingTurn === "white") {
                finalScore = -rawScore;
            }

            // ログ出力（140手目以降）
            if (analyzingStep >= 140) {
                console.groupCollapsed(`[EVAL] Step:${analyzingStep} ${debugType}`);
                console.log(`Msg: ${msg}`);
                console.log(`Raw: ${rawScore}, Turn: ${analyzingTurn}, Final: ${finalScore}`);
                console.groupEnd();
            }

            if (analyzingStep !== -1) {
                evalHistory[analyzingStep] = finalScore;
                updateChart();
            }
        }
    }
}

function sendToEngine(msg) {
    if (typeof engineWorker !== 'undefined' && engineWorker) engineWorker.postMessage(msg);
}

// 棋譜読み込み・描画系（省略せず元のまま）
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
            sendToEngine("stop");
            updateChart(); 
        }
    }
}

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
                    textSpan.style.color = "#007bff"; textSpan.style.fontWeight = "bold"; textSpan.style.textShadow = "1px 1px 0px #fff"; 
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

function renderHands() {
    const bh = document.getElementById("blackHand"), wh = document.getElementById("whiteHand");
    if (!bh || !wh) return;
    const order = ["P", "L", "N", "S", "G", "B", "R", "K"]; 
    hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    bh.innerHTML = ""; wh.innerHTML = "";
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
    hands.black.forEach(p => { bh.appendChild(createHandPiece("black", p)); });
    hands.white.forEach(p => { wh.appendChild(createHandPiece("white", p)); });
}

function playReplayCutIn(imageName) {
    const img = document.getElementById("skillCutIn");
    if (!img) return;
    img.src = "script/image/" + imageName;
    img.classList.remove("cut-in-active");
    void img.offsetWidth;
    img.classList.add("cut-in-active");
}

function initChart() {
    const ctx = document.getElementById('evalChart').getContext('2d');
    if (evalChart) evalChart.destroy();
    evalChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ 
            data: evalHistory, borderColor: '#ff4500', backgroundColor: 'rgba(255, 69, 0, 0.1)', fill: true, tension: 0.3,
            pointStyle: (ctx) => discoveryFlags[ctx.dataIndex] ? 'star' : 'circle',
            pointRadius: (ctx) => discoveryFlags[ctx.dataIndex] ? 10 : (matchFlags[ctx.dataIndex] ? 3 : 2),
            pointBackgroundColor: (ctx) => { if (discoveryFlags[ctx.dataIndex]) return '#ffd700'; if (matchFlags[ctx.dataIndex]) return '#1e90ff'; return '#ff4500'; },
            pointBorderColor: (ctx) => discoveryFlags[ctx.dataIndex] ? '#b8860b' : (matchFlags[ctx.dataIndex] ? '#0000cd' : '#ff4500'),
            pointBorderWidth: (ctx) => (discoveryFlags[ctx.dataIndex] || matchFlags[ctx.dataIndex]) ? 2 : 1
        }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: -1000, max: 1000 }, x: { type: 'category', grid: { display: false } } }, plugins: { legend: { display: false }, zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } }, onClick: (e, elements) => { if (elements.length > 0) { currentStep = elements[0].index; applyState(replayStates[currentStep]); } } },
        plugins: [{ id: 'currentStepLine', afterDraw: (chart) => { if (currentStep < 0 || currentStep >= chart.data.labels.length) return; const ctx = chart.ctx, xAxis = chart.scales.x, yAxis = chart.scales.y; const xPos = xAxis.getPixelForValue(chart.data.labels[currentStep]); if (isNaN(xPos)) return; ctx.save(); ctx.beginPath(); ctx.moveTo(xPos, yAxis.top); ctx.lineTo(xPos, yAxis.bottom); ctx.lineWidth = 2; ctx.strokeStyle = 'red'; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.restore(); } }]
    });
}

function resetChartZoom() { if (evalChart) evalChart.resetZoom(); }

function updateChart() {
    if (!evalChart) return;
    evalChart.data.labels = replayStates.map((_, i) => i.toString());
    evalChart.data.datasets[0].data = evalHistory.map((score, i) => {
        if (score === undefined) return null;
        if (score > 20000) return 10000;
        if (score < -20000) return -10000;
        return score;
    });
    evalChart.update();
    const currentScore = evalHistory[currentStep];
    const evalElem = document.getElementById("numericEval");
    if (evalElem && currentScore !== undefined) {
        if (Math.abs(currentScore) >= 20000) {
            const winner = currentScore > 0 ? "先手" : "後手";
            evalElem.textContent = `評価値: ${winner}勝ち`;
        } else {
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

async function startAutoAnalysis(timePerMove) {
    const n = replayStates.length - 1;
    if (n <= 10) return alert("この棋譜は短すぎます。");
    let maxSeconds = (timePerMove === 1000) ? n : (timePerMove === 5000 ? 20 + 5*(n-10) : 20 + 10*(n-10));
    const isConfirmed = await showCustomConfirm(`全自動モードを開始します。\n最大予測時間：${formatSeconds(maxSeconds)}\n解析を開始してもよろしいですか？`);
    if (!isConfirmed) return; 
    if (isAutoAnalyzing) stopAutoAnalysis();
    isAutoAnalyzing = true;
    document.getElementById("stopAutoBtn").style.display = "inline-block";
    for (let i = currentStep; i < replayStates.length; i++) {
        if (!isAutoAnalyzing) break;
        currentStep = i; analyzingStep = i; analyzingTurn = replayStates[i].turn;
        applyState(replayStates[i]);
        searchStartTime = Date.now();
        lastBestMoveAt1s = null;
        let effectiveTime = (i <= 10 && timePerMove > 2000) ? 2000 : timePerMove;
        sendToEngine("stop");
        sendToEngine("position sfen " + generateSfen());
        sendToEngine("go movetime " + (effectiveTime + 1000));
        await new Promise(resolve => { analysisResolver = resolve; autoAnalysisTimer = setTimeout(() => { if (analysisResolver === resolve) { analysisResolver(); analysisResolver = null; } }, effectiveTime); });
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

function getRecommendation() {
    if (!isEngineReady) return alert("エンジンが準備中です。");
    recommendedMove = null; render();
    const btn = document.getElementById("recommendBtn");
    btn.disabled = true;
    sendToEngine("stop");
    isWaitingRecommendation = false;
    setTimeout(() => {
        isWaitingRecommendation = true;
        sendToEngine("position sfen " + generateSfen());
        sendToEngine("go movetime 5000");
        let timeLeft = 5;
        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) btn.textContent = `考え中…`;
            else { clearInterval(timer); btn.textContent = "おすすめ"; btn.disabled = false; }
        }, 1000);
    }, 100);
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

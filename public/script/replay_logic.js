// ==========================================
// replay_logic.js - ステートマシン完全制御版
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

// ★重要：エンジンの状態管理（信号機）
// 'IDLE':     待機中。命令を送ってよい。
// 'THINKING': 計算中。stopを送る必要がある。
// 'STOPPING': stopを送った直後。bestmoveが返ってくるのを待っている（命令を送ってはいけない）。
let engineState = 'IDLE';

// 解析予約（ユーザーが連打した場合、最後に解析すべき手数をここに保持）
let pendingStepRequest = -1;

// --- 全自動検討・おすすめ用の変数 ---
let isAutoAnalyzing = false;
let autoAnalysisTimer = null;
let recommendedMove = null;

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
    let sfen = "startpos";
    if (typeof convertBoardToSFEN === 'function') {
        // ※ここでanalyzingStepを使うかcurrentStepを使うか注意が必要だが、
        //  startRealAnalysis内で同期をとるため currentStep で生成する
        sfen = convertBoardToSFEN(boardState, hands, window.turn, currentStep);
    }
    return sfen;
}

// ■■■ 解析リクエスト（入り口） ■■■
// ユーザーがボタンを押したりステップが変わった時に呼ばれる
function analyzeCurrentPosition() {
    if (!isEngineReady) return;

    // 「今、解析したい場所」を予約する
    pendingStepRequest = currentStep;
    analyzingTurn = window.turn; // 手番情報も更新しておく

    console.log(`[STATE] Request received for Step:${currentStep}. Current State: ${engineState}`);

    // 状態に応じた分岐処理
    if (engineState === 'IDLE') {
        // 暇ならすぐに解析開始
        startRealAnalysis();
    } 
    else if (engineState === 'THINKING') {
        // 計算中なら止める命令を出す
        // ※ここでの position/go は送らない！ bestmoveが帰ってきたら再開する。
        engineState = 'STOPPING';
        sendToEngine("stop");
    }
    else if (engineState === 'STOPPING') {
        // すでに停止処理中なら何もしない（停止後に pendingStepRequest を見て再開してくれる）
        console.log(`[STATE] Already stopping. Request queued for Step:${currentStep}`);
    }
}

// ■■■ 実際の解析開始処理 ■■■
// 必ず 'IDLE' 状態からしか呼ばれない
function startRealAnalysis() {
    // 予約がない、または画面とズレている場合は最新に合わせる
    if (pendingStepRequest !== -1) {
        if (currentStep !== pendingStepRequest) {
            // ユーザーが連打して画面がさらに進んでいた場合などは、画面(currentStep)を優先するか予約を優先するか。
            // ここでは予約(pendingStepRequest)を処理し、終わったらまた次へ、とするのが安全。
            // ただし簡易化のため currentStep を正とする。
        }
    }
    
    // 状態を「計算中」に変更
    engineState = 'THINKING';
    
    analyzingStep = currentStep;
    analyzingTurn = window.turn;
    searchStartTime = Date.now();
    lastBestMoveAt1s = null;

    const sfen = generateSfen();
    console.log(`[STATE] Starting Analysis for Step:${analyzingStep} | Turn:${analyzingTurn}`);
    console.log(`[SFEN] ${sfen}`);

    sendToEngine("position sfen " + sfen);
    sendToEngine("go movetime 100000"); 
}

function handleEngineMessage(msg) {
    if (msg === "usiok") sendToEngine("isready");
    else if (msg === "readyok") {
        isEngineReady = true;
        // 起動時に解析が必要なら開始
        if (!isAutoAnalyzing && analyzingStep === -1) {
             analyzeCurrentPosition();
        }
    }

    if (typeof msg === "string") {
        
        // --- 1秒時点の候補手サンプリング ---
        // (STOPPING中は無視する)
        if (msg.includes("info") && msg.includes("pv") && engineState === 'THINKING') {
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
            console.log(`[STATE] bestmove received. Previous State: ${engineState}`);
            
            // 何はともあれ、bestmoveが来たらエンジンは「暇」になる
            engineState = 'IDLE';

            // もし「解析したい新しい場所(pendingStepRequest)」が「今終わった場所(analyzingStep)」と違うなら、
            // すぐに新しい解析を始める（これが連打対応のキモ）
            if (pendingStepRequest !== -1 && pendingStepRequest !== analyzingStep) {
                console.log(`[STATE] Step mismatch (Done:${analyzingStep}, Want:${pendingStepRequest}). Restarting.`);
                startRealAnalysis();
                return; // ここでリターンして、古い解析結果で画面更新するのを防ぐ
            }
            
            // ここまで来たら「最新の解析結果」として処理する
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

        // 評価値処理
        // ★重要: THINKING状態の時だけ処理する（STOPPING中の古いinfoは無視）
        if ((msg.includes("score cp") || msg.includes("score mate")) && engineState === 'THINKING') {
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
            
            // 後手番なら評価値を反転
            // ※analyzingTurn は startRealAnalysis で固定されているのでズレない
            if (analyzingTurn === "white") {
                rawScore = -rawScore;
            }

            if (analyzingStep !== -1) {
                evalHistory[analyzingStep] = rawScore;
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

    // ★修正: オート解析でないなら、「最新の解析リクエスト」を投げる
    // 状態管理(IDLE/THINKING)は analyzeCurrentPosition 内で行うので、ここでは呼ぶだけで良い
    if (!isAutoAnalyzing) {
        // すでに計算済みのStepでなければ解析
        if (evalHistory[currentStep] === undefined) {
            analyzeCurrentPosition();
        } else {
            // 計算済みなら、もしエンジンが動いていれば止める（無駄な計算リソース節約）
            if (engineState === 'THINKING') {
                engineState = 'STOPPING';
                sendToEngine("stop");
            }
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
            const p = boardState[y][x]; // 実際の駒
            
            // おすすめの一手がある場合、その情報を優先して表示するか判定
            let displayPiece = p;
            let isRecommendation = false;

            if (recommendedMove && recommendedMove.x === x && recommendedMove.y === y) {
                // おすすめの手の場所に「おすすめの駒名」を表示する
                isRecommendation = true;
            }

            // --- 駒の描画処理 ---
            if (displayPiece || isRecommendation) {
                const isW = displayPiece === displayPiece.toLowerCase() && displayPiece !== "";
                const key = displayPiece.startsWith("+") ? "+" + displayPiece.replace("+","").toUpperCase() : displayPiece.toUpperCase();
                
                // おすすめ表示の場合はその文字、そうでなければ pieceName から取得
                let charText = (typeof pieceName !== 'undefined' && pieceName[key]) ? pieceName[key] : key;
                if (isRecommendation) charText = recommendedMove.name;

                // ★ハイブリッド方式：コンテナ作成
                const container = document.createElement("div");
                container.className = "piece-container";

                // ★サイズ補正クラス (例: size-P)
                if (!isRecommendation && displayPiece !== "") {
                    const baseType = displayPiece.replace("+", "").toUpperCase();
                    container.classList.add("size-" + baseType);
                }

                // ★後手番の影反転
                if (isW) {
                    container.classList.add("gote");
                }

                // 文字表示
                const textSpan = document.createElement("span");
                textSpan.className = "piece-text";
                if (key.startsWith("+")) textSpan.classList.add("promoted");
                
                textSpan.textContent = charText;

                // おすすめの場所の特別スタイル
                if (isRecommendation) {
                    td.classList.add("recommended-cell");
                    textSpan.style.color = "#007bff";       // 青色
                    textSpan.style.fontWeight = "bold";     // 太字
                    textSpan.style.textShadow = "1px 1px 0px #fff"; // 視認性向上のための白フチ
                    // おすすめの手番が後手なら回転
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

            // 移動元のハイライト
            if (lastMoveInfo.from && lastMoveInfo.from.x === x && lastMoveInfo.from.y === y) {
                td.classList.add("move-from");
            }
            // 移動先のハイライト
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

    // 持ち駒の並び順定義
    const order = ["P", "L", "N", "S", "G", "B", "R", "K"]; // K(玉)も念のため追加
    
    // ソート実行
    hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    // HTMLのリセット
    bh.innerHTML = "";
    wh.innerHTML = "";

    // 持ち駒生成ヘルパー関数
    const createHandPiece = (player, p) => {
        // ★コンテナ作成
        const container = document.createElement("div");
        container.className = "hand-piece-container";

        // ★後手の影反転
        if (player === "white") {
            container.classList.add("gote");
            // コンテナ自体を回転（CSSで対応済みなら不要ですが、念のため）
            container.style.transform = "rotate(180deg)";
        }

        // 文字作成
        const textSpan = document.createElement("span");
        textSpan.className = "piece-text";
        // pieceNameが定義されていれば変換、なければそのまま
        textSpan.textContent = (typeof pieceName !== 'undefined') ? pieceName[p] : p;

        container.appendChild(textSpan);
        return container;
    };

    // 先手の持ち駒生成
    hands.black.forEach(p => {
        bh.appendChild(createHandPiece("black", p));
    });

    // 後手の持ち駒生成
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
 * 6. オート検討
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
        
        searchStartTime = Date.now();
        lastBestMoveAt1s = null;

        let effectiveTime = (i <= 10 && timePerMove > 2000) ? 2000 : timePerMove;
        sendToEngine("stop");
        sendToEngine("position sfen " + generateSfen());
        sendToEngine("go movetime " + (effectiveTime + 1000));
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

/**
 * おすすめ機能
 */
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

// script/main_online_player.js (Final Fixed Version)

// ★★★ 1. Socket初期化 ★★★
const socket = io({ autoConnect: false });

// DOM要素
const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");

// 自分のキャラID
const myCharId = sessionStorage.getItem('my_character') || 'default';

// --- 変数定義 ---
// globals.js にある変数は let を付けずに初期化
boardState = []; 
hands = { black: [], white: [] };
turn = "black";
moveCount = 0;
kifu = [];
pieceStyles = Array(9).fill(null).map(() => Array(9).fill(null));
history = []; 

lastMoveTo = null;
lastMoveFrom = null;
selected = null;
legalMoves = [];

currentSkill = null;
skillUseCount = 0;
isSkillTargeting = false;
gameOver = false;
winner = null;
bgm = null;
moveSound = null;
promoteSound = null;
cpuEnabled = false; 

// オンライン専用変数 (let必要)
let p1Skill = null;      
let p2Skill = null;      
let p1SkillCount = 0;    
let p2SkillCount = 0;    

let pendingMove = null; 
let myRole = null;
let endReason = null;
let isGameStarted = false;
let hasShownEndEffect = false;

window.isCaptureRestricted = false;
let lastSkillKifu = ""; 

// ★時間管理用
let remainingTime = { black: 1200, white: 1200 }; // 20分
let timerInterval = null;

// ★★★ 2. 初期化処理 (load) ★★★
window.addEventListener("load", () => {
    cpuEnabled = false;
    bgm = document.getElementById("bgm");
    moveSound = document.getElementById("moveSound");
    promoteSound = document.getElementById("promoteSound");

    const charNameMap = {
        'default': 'いつも通り', 'char_a': '熱血',
        'char_b': '冷静', 'char_d': '町田'
    };
    const myCharName = charNameMap[myCharId] || "不明なキャラ";
    const displaySpan = document.getElementById("myCharNameDisplay");
    if (displaySpan) displaySpan.textContent = myCharName;

    applyPlayerImage(); 

    if (resignBtn) resignBtn.addEventListener("click", resignGame);

    playBGM();
    statusDiv.textContent = "認証を確認中..."; 
    render();

    if (typeof showKifu === "function") showKifu();
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            applyUserSkin();
        }
    });
});

// ★★★ 3. Firebase認証 & Socket接続 ★★★
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log("ログイン確認:", user.uid);
            const displayName = user.displayName || (user.email ? user.email.split('@')[0] : "名無し");
            localStorage.setItem('shogi_username', displayName);

            // 接続開始
            socket.io.opts.query = { userId: user.uid };
            socket.connect();

            setupSocketListeners(user.uid);
        } else {
            alert("オンライン対戦をするにはログインが必要です。");
            window.location.href = "index.html"; 
        }
    });
} else {
    console.error("Firebase load error");
}

// ★★★ 4. Socketイベント定義 ★★★
function setupSocketListeners(myUserId) {
    
    socket.on('connect', () => {
        console.log("Connected. ID:", myUserId);
        const urlParams = new URLSearchParams(window.location.search);
        let roomId = urlParams.get('room') || "default";
        localStorage.setItem('current_shogi_room', roomId);

        socket.emit('enter game', { 
            roomId: roomId, userId: myUserId, charId: myCharId 
        });

        const name = localStorage.getItem('shogi_username') || "ゲスト";
        socket.emit('chat message', { text: `${name}さんが入室しました`, isSystem: true });
    });

    socket.on('force room close', () => {
        alert("対局終了から一定時間が経過したため、ルームを閉じます。");
        localStorage.removeItem('current_shogi_room');
        window.location.href = "index.html";
    });

    socket.on('role assigned', (role) => {
        myRole = role;
        let roleName = "観戦者";
        if (myRole === "black") roleName = "先手 (▲)";
        if (myRole === "white") roleName = "後手 (△)";
        
        statusDiv.textContent = `接続しました。待機中... （あなたは ${roleName} です）`;

        if (myRole === "white") document.body.classList.add("view-white");
        else document.body.classList.remove("view-white");
        
        updateHandLayout(myRole);
        render();
    });

    socket.on('update room status', (data) => {
        if (data.blackChar && data.whiteChar) {
            initSkills(data.blackChar, data.whiteChar);
        }
        if (!isGameStarted) {
            let msg = "待機中...";
            const isOpponentPresent = (myRole === 'black' && data.whiteId) || (myRole === 'white' && data.blackId);
            if (isOpponentPresent) {
                const amIReady = (myRole === 'black' ? data.blackReady : data.whiteReady);
                const isOpponentReady = (myRole === 'black' ? data.whiteReady : data.blackReady);
                msg = "対戦相手が入室しています。";
                msg += amIReady ? " [あなた: 準備完了]" : " [あなた: 未完了]";
                msg += isOpponentReady ? " [相手: 準備完了]" : " [相手: 未完了]";
            } else {
                msg = "対戦相手の入室を待っています...";
            }
            statusDiv.textContent = msg;
        }
    });

    socket.on('game start', (data) => {
        console.log("対局開始！");
        if (data && data.blackCharId && data.whiteCharId) {
            initSkills(data.blackCharId, data.whiteCharId);
        }
        initGameSequence(); 
    });

    socket.on('restore game', (savedState) => {
        console.log("Restore:", savedState);
        boardState = savedState.boardState;
        hands = savedState.hands;
        turn = savedState.turn;
        moveCount = savedState.moveCount;
        kifu = savedState.kifu;
        
        lastMoveTo = savedState.lastMoveTo || null;
        lastMoveFrom = savedState.lastMoveFrom || null;
        p1SkillCount = savedState.p1SkillCount || 0;
        p2SkillCount = savedState.p2SkillCount || 0;

        if (savedState.blackCharId && savedState.whiteCharId) {
            initSkills(savedState.blackCharId, savedState.whiteCharId);
        }
        if (savedState.remainingTime) {
            remainingTime = savedState.remainingTime;
        }

        isGameStarted = true;
        gameOver = false;
        
        const overlay = document.getElementById("waitingOverlay");
        if (overlay) overlay.style.display = "none";

        updateTimeDisplay();
        render();
        statusDiv.textContent = `再接続しました。現在 ${moveCount} 手目です。`;
        startTimer();
        
        if (myRole) {
            updateHandLayout(myRole);
            if (myRole === "white") document.body.classList.add("view-white");
            else document.body.classList.remove("view-white");
        }
    });

    socket.on('sync time', (times) => {
        console.log("時間のズレを修正しました");
        remainingTime = times;
        updateTimeDisplay();
    });

    socket.on('shogi move', (data) => {
        if (data.isTimeWarp) {
            console.log("TimeWarp受信");
            const state = data.gameState;
            if (state.remainingTime) {
                remainingTime = state.remainingTime;
                updateTimeDisplay();
            }
            boardState = state.boardState;
            hands = state.hands;
            turn = state.turn;
            moveCount = state.moveCount;
            kifu = state.kifu;
            p1SkillCount = state.p1SkillCount;
            p2SkillCount = state.p2SkillCount;
            
            render();
            startTimer();
            statusDiv.textContent = "相手が時を戻しました！";
        } else {
            if (data.gameState && data.gameState.remainingTime) {
                remainingTime = data.gameState.remainingTime;
                updateTimeDisplay(); // 画面の数字を即座に更新
            }
            executeMove(data.sel, data.x, data.y, data.promote, true);
        }
    });

    socket.on('skill activate', (data) => {
        const skillToUse = (data.turn === "black") ? p1Skill : p2Skill;
        if (!skillToUse) return;



        currentSkill = skillToUse; 
        
        // 2. 受信側でも必ず execute を実行して、盤面の状態（成る・色変え・移動）を更新する
        const result = skillToUse.execute(data.x, data.y);

        // 3. 完了判定
        if (data.isFinished) {
            // 技が完了した場合（BluePrintや、SilverArmorの2手目など）
            // 実行結果(result)を渡して終了処理を行う
            // ※万が一 result が null の場合でも進行するように "SYSTEM" をフォールバックにする
            processSkillAfterEffect(skillToUse, result || "SYSTEM", data.turn);
        } else {
            // 技がまだ続く場合（SilverArmorの1手目など）
            // ここで processSkillAfterEffect を呼ぶと reset() されてしまうので呼んではいけない。
            // 盤面を再描画して（選択色の反映など）、次の通信を待つ。
            render();
        }
    });

    socket.on('game resign', (data) => {
        const winColor = (data.loser === "black") ? "white" : "black";
        resolveResignation(winColor, data.reason);
    });

    socket.on('game reset', () => { resetGame(); });
    socket.on('chat message', (data) => { addMessageToChatHistory(data); });
}

// ----------------------------------------------------
// ★★★ ロジック関数 ★★★
// ----------------------------------------------------

function initGameSequence() {
    const overlay = document.getElementById("waitingOverlay");
    if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => { overlay.style.display = "none"; }, 500);
    }
    const cutInImg = document.getElementById("skillCutIn");
    const isSente = (myRole !== "white");
    const imgPath = isSente ? "script/image/sente.PNG" : "script/image/gote.PNG";
    const audioPath = isSente ? "script/audio/sente.mp3" : "script/audio/gote.mp3";
    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play().catch(e => {});

    if (cutInImg) {
        cutInImg.src = imgPath;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth; 
        cutInImg.classList.add("cut-in-active");
    }
    setTimeout(() => {
        if (cutInImg) cutInImg.classList.remove("cut-in-active");
        startActualGame();
    }, 1000);
}

function startActualGame() {
    isGameStarted = true;
    statusDiv.textContent = "対局開始！";
    startTimer();
    render();
}

function initSkills(blackId, whiteId) {
    if (blackId) sessionStorage.setItem('online_black_char', blackId);
    if (whiteId) sessionStorage.setItem('online_white_char', whiteId);

    const b = blackId || sessionStorage.getItem('online_black_char') || 'default';
    const w = whiteId || sessionStorage.getItem('online_white_char') || 'default';

    if (b === 'default' && typeof CharItsumono !== 'undefined') p1Skill = CharItsumono.skill;
    else if (b === 'char_a' && typeof CharNekketsu !== 'undefined') p1Skill = CharNekketsu.skill;
    else if (b === 'char_b' && typeof CharReisei !== 'undefined') p1Skill = CharReisei.skill;
    else if (b === 'char_d' && typeof CharMachida !== 'undefined') p1Skill = CharMachida.skill;

    if (w === 'default' && typeof CharItsumono !== 'undefined') p2Skill = CharItsumono.skill;
    else if (w === 'char_a' && typeof CharNekketsu !== 'undefined') p2Skill = CharNekketsu.skill;
    else if (w === 'char_b' && typeof CharReisei !== 'undefined') p2Skill = CharReisei.skill;
    else if (w === 'char_d' && typeof CharMachida !== 'undefined') p2Skill = CharMachida.skill;
 
    applyPlayerImage();
    syncGlobalSkillState();
}

function syncGlobalSkillState() {
    if (turn === "black") {
        currentSkill = p1Skill;
        skillUseCount = p1SkillCount; 
    } else {
        currentSkill = p2Skill;
        skillUseCount = p2SkillCount; 
    }
    if (currentSkill) {
        const max = currentSkill.maxUses || 1;
        window.skillUsed = (skillUseCount >= max);
    } else {
        window.skillUsed = true;
    }
    updateSkillButton();
}

function updateSkillButton() {
    const skillBtn = document.getElementById("skillBtn");
    if (!skillBtn) return;

    let mySkill = null;
    let myUseCount = 0;

    if (myRole === "black") { mySkill = p1Skill; myUseCount = p1SkillCount; }
    else if (myRole === "white") { mySkill = p2Skill; myUseCount = p2SkillCount; }
    else { skillBtn.style.display = "none"; return; }

    if (mySkill) {
        skillBtn.style.display = "inline-block";
        skillBtn.textContent = mySkill.name;
        if (mySkill.buttonStyle) Object.assign(skillBtn.style, mySkill.buttonStyle);
        else {
            skillBtn.style.backgroundColor = "#ff4500";
            skillBtn.style.color = "white";
            skillBtn.style.border = "none";
        }
        const max = mySkill.maxUses || 1;
        const isUsedUp = (myUseCount >= max);
        if (turn !== myRole || isUsedUp) {
            skillBtn.disabled = true;
            skillBtn.style.opacity = 0.5;
            if (isUsedUp) {
                skillBtn.style.backgroundColor = "#ccc";
                skillBtn.style.border = "1px solid #999";
            }
        } else {
            skillBtn.disabled = false;
            skillBtn.style.opacity = 1.0;
        }
    } else {
        skillBtn.style.display = "none";
    }
}

function toggleSkillMode() {
    if (gameOver) return;
    if (myRole && turn !== myRole) return;
    if (!currentSkill) return;
    if (isSkillTargeting) return;
    if (window.skillUsed) { alert("必殺技はもう使えません。"); return; }
    if (!currentSkill.canUse()) { alert("発動条件を満たしていません。"); return; }
    document.getElementById("skillModal").style.display = "flex";
}

function confirmSkillActivate() {
    closeSkillModal();
    if (currentSkill.reset) currentSkill.reset();
    selected = null;
    const targets = currentSkill.getValidTargets();
    if (!targets || targets.length === 0) {
        alert("有効なターゲットがありません。");
        isSkillTargeting = false;
        return; 
    }
    isSkillTargeting = true;
    legalMoves = targets;
    document.getElementById("board").classList.add("skill-targeting-mode");
    render();
    statusDiv.textContent = `必殺技【${currentSkill.name}】：対象を選んでください`;
}

function closeSkillModal() { document.getElementById("skillModal").style.display = "none"; }

function applyPlayerImage() {
    const blackHandBox = document.getElementById("blackHandBox");
    const bId = sessionStorage.getItem('online_black_char');
    if (blackHandBox) blackHandBox.style.backgroundImage = getImageUrlById(bId) || 'none';

    const whiteHandBox = document.getElementById("whiteHandBox");
    const wId = sessionStorage.getItem('online_white_char');
    if (whiteHandBox) whiteHandBox.style.backgroundImage = getImageUrlById(wId) || 'none';
}

function getImageUrlById(charId) {
    if (!charId || charId === 'null') return null;
    if (charId === 'char_a') return "url('script/image/char_a.png')";
    if (charId === 'char_b') return "url('script/image/char_b.png')";
    if (charId === 'default') return "url('script/image/karui_1p.PNG')";
    if (charId === 'char_d') return "url('script/image/char_d.png')";
    return null;
}

// --- タイマー ---
function startTimer() {
    stopTimer();
    updateTimeDisplay();
    timerInterval = setInterval(() => {
        if (remainingTime[turn] > 0) {
            remainingTime[turn]--;
            updateTimeDisplay();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimeDisplay() {
    const blackTimer = document.getElementById("blackTimer");
    const whiteTimer = document.getElementById("whiteTimer");
    if (blackTimer) blackTimer.textContent = "▲先手: " + formatTime(remainingTime.black);
    if (whiteTimer) whiteTimer.textContent = "△後手: " + formatTime(remainingTime.white);
    
    if (turn === 'black') {
        if(blackTimer) blackTimer.style.fontWeight = "bold";
        if(whiteTimer) whiteTimer.style.fontWeight = "normal";
    } else {
        if(blackTimer) blackTimer.style.fontWeight = "normal";
        if(whiteTimer) whiteTimer.style.fontWeight = "bold";
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function playBGM() {
    if (!bgm) return;
    bgm.volume = 0.3;
    bgm.play().catch(() => {
        document.addEventListener("click", () => { bgm.play().catch(e => {}); }, { once: true });
    });
}

function onCellClick(x, y) {
    if (!isGameStarted) return; 
    if (gameOver) return;
    if (myRole && turn !== myRole) return;

    if (isSkillTargeting) {
        if (legalMoves.some(m => m.x === x && m.y === y)) {
            


            // TimeWarp
            if (currentSkill && currentSkill.isSystemAction) {
                currentSkill.execute(x, y);
                isSkillTargeting = false; legalMoves = []; selected = null;
                document.getElementById("board").classList.remove("skill-targeting-mode");
                undoMove(); 
                if (turn === "black") p1SkillCount++; else p2SkillCount++;
                syncGlobalSkillState();

                if (socket) {
                    socket.emit('skill activate', { x: 0, y: 0, turn: turn, isFinished: true });
                    const newState = deepCopyState(); 
                    const sendState = {
                        boardState: newState.boardState, hands: newState.hands, turn: newState.turn,
                        moveCount: newState.moveCount, kifu: newState.kifu,
                        p1SkillCount: newState.p1SkillCount, p2SkillCount: newState.p2SkillCount,
                        blackCharId: sessionStorage.getItem('online_black_char'),
                        whiteCharId: sessionStorage.getItem('online_white_char')
                    };
                    socket.emit('shogi move', { 
                        gameState: sendState, isTimeWarp: true, sel: {x:0,y:0}, x:0, y:0, promote:false
                    });
                }
                render();
                statusDiv.textContent = "必殺技発動！ 時を戻しました。";
                return;
            }
            // Normal Skill
            const result = currentSkill.execute(x, y);
            if (socket) socket.emit('skill activate', { x: x, y: y, turn: turn, isFinished: (result !== null) });
            if (result === null) {
                legalMoves = currentSkill.getValidTargets();
                render();
                statusDiv.textContent = "移動させる場所を選んでください";
                return; 
            }
            processSkillAfterEffect(currentSkill, result, turn);
        }
        return;
    }
    
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
    if (legalMoves.some(m => m.x === x && m.y === y)) movePieceWithSelected(sel, x, y);
    selected = null; legalMoves = []; render();
}

function selectFromHand(player, index) {
    if (!isGameStarted) return; 
    if (gameOver) return;
    if (myRole && turn !== myRole) return;
    if (turn !== player) return;
    selected = { fromHand: true, player, index };
    legalMoves = getLegalDrops(player, hands[player][index]);
    render();
}

function movePieceWithSelected(sel, x, y) {
    if (sel.fromHand) { executeMove(sel, x, y, false); return; }
    const piece = boardState[sel.y][sel.x];
    const isWhite = piece === piece.toLowerCase();
    const player = isWhite ? "white" : "black";
    const isPromoted = piece.includes("+");
    const base = piece.replace("+","").toUpperCase();

    if (!isPromoted && canPromote(base) && 
        (isInPromotionZone(sel.y, player) || isInPromotionZone(y, player))) {
        const mustPromote = (base === "P" || base === "L") && (y === (player === "black" ? 0 : 8)) ||
                            (base === "N") && (y === (player === "black" ? 0 : 8) || y === (player === "black" ? 1 : 7));
        if (mustPromote) executeMove(sel, x, y, true);
        else {
            pendingMove = { sel, x, y }; 
            const modal = document.getElementById("promoteModal");
            if (modal) modal.style.display = "flex";
            else {
                if(confirm("成りますか？")) executeMove(sel, x, y, true);
                else executeMove(sel, x, y, false);
            }
        }
    } else executeMove(sel, x, y, false);
}

function executeMove(sel, x, y, doPromote, fromNetwork = false) {
    history.push(deepCopyState());
    if (sel.fromHand) lastMoveFrom = null; else lastMoveFrom = { x: sel.x, y: sel.y }; 

    const pieceBefore = sel.fromHand ? hands[sel.player][sel.index] : boardState[sel.y][sel.x];
    const moveNumber = kifu.length + 1; 
    if (moveSound) { moveSound.currentTime = 0; moveSound.play().catch(() => {}); }

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
            if (promoteSound) { promoteSound.currentTime = 0; promoteSound.play().catch(() => {}); }
            const boardTable = document.getElementById("board");
            if (boardTable) {
                boardTable.classList.remove("flash-green", "flash-orange");
                void boardTable.offsetWidth;
                if (base === "R") boardTable.classList.add("flash-green");
                else if (base === "B") boardTable.classList.add("flash-orange");
                setTimeout(() => { if(boardTable) boardTable.className = ""; }, 2000);
            }
        } else {
            if (!piece.includes("+") && canPromote(base) && 
                (isInPromotionZone(sel.y, player) || isInPromotionZone(y, player))) sel.unpromoted = true;
        }
        boardState[sel.y][sel.x] = "";
        boardState[y][x] = piece;
        pieceStyles[y][x] = pieceStyles[sel.y][sel.x];
        pieceStyles[sel.y][sel.x] = null;
    }

    const currentMoveStr = formatMove(sel, x, y, pieceBefore, [], moveNumber);
    const currentMoveContent = currentMoveStr.split("：")[1] || currentMoveStr;
    kifu.push(""); 
    if (typeof lastSkillKifu !== 'undefined' && lastSkillKifu !== "") {
        kifu[kifu.length - 1] = `${moveNumber}手目：${lastSkillKifu}★，${currentMoveContent}`;
        lastSkillKifu = ""; 
    } else kifu[kifu.length - 1] = currentMoveStr;

    lastMoveTo = { x, y };
    turn = turn === "black" ? "white" : "black";
    window.isCaptureRestricted = false;
    
    syncGlobalSkillState();
    if (typeof showKifu === "function") showKifu();
    render(); 

    if (!gameOver) startTimer(); else stopTimer();
    moveCount++; 

    if (!fromNetwork) {
        const newState = {
            boardState: boardState,
            hands: hands,
            turn: turn,
            moveCount: moveCount,
            kifu: kifu,
            p1SkillCount: p1SkillCount,
            p2SkillCount: p2SkillCount,
            // ★★★ 【追加】現在の残り時間をパケットに含める ★★★
            remainingTime: remainingTime, 
            
            blackCharId: sessionStorage.getItem('online_black_char'),
            whiteCharId: sessionStorage.getItem('online_white_char')
        };
        // 変更なし
        socket.emit('shogi move', { sel: sel, x: x, y: y, promote: doPromote, gameState: newState });
    }

    if (moveCount >= 500) {
        gameOver = true; winner = null;
        statusDiv.textContent = "500手引き分け";
        if(socket) socket.emit('game over');
        render(); return;
    }
    if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
        gameOver = true;
        winner = turn === "black" ? "white" : "black";
        if (myRole === "black" || myRole === "white") {
            const result = (winner === myRole) ? "win" : "lose";
            saveGameResult(result);
        }
        if(socket) socket.emit('game over');
        render(); return;
    }
    
    const key = getPositionKey();
    positionHistory[key] = (positionHistory[key] || 0) + 1;
    recordRepetition();
    if (positionHistory[key] >= 4) {
        gameOver = true;
        const records = repetitionHistory[key].slice(-4);
        if (records[0].checkingSide !== null) {
            winner = records[0].checkingSide === "black" ? "white" : "black";
            statusDiv.textContent = "連続王手の千日手。反則負けです。";
        } else {
            winner = null;
            statusDiv.textContent = "千日手です。引き分け。";
        }
        if(socket) socket.emit('game over');
        render();
    }
}

function render() {
    if (!boardState || boardState.length === 0) return;

    if (gameOver) {
        if (!hasShownEndEffect && winner) {
            playGameEndEffect(winner);
            hasShownEndEffect = true; 
        }
        if (endReason) statusDiv.textContent = endReason;
        else if (winner === "black") statusDiv.textContent = "先手の勝ちです！";
        else if (winner === "white") statusDiv.textContent = "後手の勝ちです！";
        else statusDiv.textContent = "引き分けです。";
        checkStatusDiv.textContent = "";

        // script/main_online_player.js の render() 関数内の一部

        if (!document.getElementById("resetBtn")) {
            const btn = document.createElement("button");
            btn.id = "resetBtn";
            
            // ★変更点：ボタンの文字を変える
            btn.textContent = "結果画面へ"; 
            
            // スタイル（色は変えたければ変えてOK）
            btn.style.cssText = "padding:10px 20px; font-size:16px; margin-top:10px; background-color:#d32f2f; color:white; border:none; cursor:pointer; border-radius:5px;";
            
            // ★変更点：クリック時の挙動
            btn.onclick = () => {
                // 1. 勝敗判定
                let resultStr = "DRAW";
                if (winner) {
                    // 自分の役割と勝者が一致すればWIN
                    if (winner === myRole) resultStr = "WIN";
                    else if (myRole === "black" || myRole === "white") resultStr = "LOSE";
                    else resultStr = "SPECTATOR"; // 観戦者の場合
                }

                // 2. 自分の使用キャラIDを取得
                let myCharId = "default";
                if (myRole === "black") {
                    myCharId = sessionStorage.getItem('online_black_char') || "default";
                } else if (myRole === "white") {
                    myCharId = sessionStorage.getItem('online_white_char') || "default";
                }

                // 3. 次の画面へ渡すデータを保存
                sessionStorage.setItem('last_game_result', resultStr);
                sessionStorage.setItem('last_game_my_char', myCharId);
                sessionStorage.setItem('last_game_kifu', JSON.stringify(kifu));

                // 4. ルーム情報の掃除（必要なら）
                localStorage.removeItem('current_shogi_room');

                // 5. 結果画面へ移動
                window.location.href = "result.html"; 
            };
            
            statusDiv.appendChild(document.createElement("br"));
            statusDiv.appendChild(btn);
        }
    } else {
        if (!isSkillTargeting) {
            let msg = "手番：" + (turn === "black" ? "先手" : "後手") + " / " + moveCount + "手";
            if (window.isCaptureRestricted) msg += " 【攻撃禁止中】";
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

    board.innerHTML = "";
    for (let y = 0; y < 9; y++) {
        const tr = document.createElement("tr");
        for (let x = 0; x < 9; x++) {
            const td = document.createElement("td");
            const piece = boardState[y][x];
            if (piece) {
                const isWhite = piece === piece.toLowerCase();
                const key = piece.startsWith("+") ? "+" + piece.replace("+","").toUpperCase() : piece.toUpperCase();
                const container = document.createElement("div");
                container.className = "piece-container";
                if (isWhite) container.classList.add("gote");
                const baseType = piece.replace("+", "").toUpperCase();
                container.classList.add("size-" + baseType);
                const textSpan = document.createElement("span");
                textSpan.className = "piece-text";
                if (key.startsWith("+")) textSpan.classList.add("promoted");
                const name = pieceName[key];
                textSpan.textContent = name.length > 1 ? name[name.length - 1] : name;
                if (pieceStyles[y][x] === "green") {
                    textSpan.style.color = "#32CD32";
                    textSpan.style.fontWeight = "bold";
                    textSpan.style.textShadow = "1px 1px 0px #000";
                }
                container.appendChild(textSpan);
                td.appendChild(container);
                if (isWhite) td.style.transform = "rotate(180deg)";
                if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) td.classList.add("moved");
            }
            if (lastMoveFrom && lastMoveFrom.x === x && lastMoveFrom.y === y) td.classList.add("move-from");
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

    const createHandPiece = (player, p, i) => {
        const container = document.createElement("div");
        container.className = "hand-piece-container";
        if (player === "white") container.classList.add("gote");
        const textSpan = document.createElement("span");
        textSpan.className = "piece-text";
        textSpan.textContent = pieceName[p];
        container.appendChild(textSpan);
        if (selected && selected.fromHand && selected.player === player && selected.index === i) container.classList.add("selected");
        container.onclick = () => selectFromHand(player, i);
        let shouldRotate = false;
        if (myRole === "white") { if (player === "black") shouldRotate = true; }
        else { if (player === "white") shouldRotate = true; }
        if (shouldRotate) container.style.transform = "rotate(180deg)";
        return container;
    };
    hands.black.forEach((p, i) => blackHandDiv.appendChild(createHandPiece("black", p, i)));
    hands.white.forEach((p, i) => whiteHandDiv.appendChild(createHandPiece("white", p, i)));
}

// ---------------- UI Helper Functions ----------------
function toggleChat() {
    const body = document.getElementById("chatBody");
    body.style.display = (body.style.display === "none") ? "flex" : "none";
}
function sendChatMessage() {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;
    const currentName = localStorage.getItem('shogi_username') || "ゲスト";
    socket.emit('chat message', { name: currentName, text: text, role: myRole });
    input.value = ""; 
}
function addMessageToChatHistory(data) {
    const historyDiv = document.getElementById("chatHistory");
    if (!historyDiv) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-msg";
    if (data.isSystem) {
        msgDiv.className += " chat-system";
        msgDiv.textContent = data.text;
    } else {
        const nameSpan = document.createElement("span");
        nameSpan.className = "chat-name";
        nameSpan.textContent = data.name + ":";
        if (data.role === "black") nameSpan.style.color = "#000000"; 
        else if (data.role === "white") nameSpan.style.color = "#666666";
        else nameSpan.style.color = "#28a745";
        const textSpan = document.createElement("span");
        textSpan.className = "chat-text";
        textSpan.textContent = " " + data.text; 
        msgDiv.appendChild(nameSpan);
        msgDiv.appendChild(textSpan);
    }
    historyDiv.appendChild(msgDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;
}
document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("chatInput");
    if (chatInput) chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendChatMessage(); });
});
function resignGame() {
    if (gameOver) return;
    if (myRole === "spectator") return; 
    const modal = document.getElementById("resignModal");
    if (modal) modal.style.display = "flex";
}
function executeResign() {
    closeResignModal();
    if (socket) socket.emit('game resign', { loser: myRole });
    const winColor = (myRole === "black") ? "white" : "black";
    resolveResignation(winColor, "resign");
}
function closeResignModal() { document.getElementById("resignModal").style.display = "none"; }
function resolveResignation(winnerColor, reason) {
    gameOver = true;
    stopTimer();
    winner = winnerColor;
    const winnerName = (winner === "black") ? "先手" : "後手";
    if (reason === "timeout") endReason = "時間切れにより、" + winnerName + "の勝ちです。";
    else if (reason === "disconnect") endReason = "通信切れにより、" + winnerName + "の勝ちです。";
    else endReason = "投了により、" + winnerName + "の勝ちです。";
    if (typeof showKifu === "function") showKifu();
    if (myRole === "black" || myRole === "white") {
        const result = (winner === myRole) ? "win" : "lose";
        saveGameResult(result);
    }
    render();
}
// ★★★ 修正版：勝敗に応じてゴールドを付与する関数 ★★★
function saveGameResult(resultStatus) {
    const user = auth.currentUser;
    if (!user) return; // ログインしていない場合は何もしない

    const isWin = (resultStatus === "win");
    
    // ★追加：獲得ゴールドの計算
    // 勝ちなら150G、負けなら30G（金額はお好みで調整してください）
    let earnedGold = 0;
    if (isWin) {
        earnedGold = 150; 
    } else if (resultStatus === "lose") {
        earnedGold = 30;
    } else {
        // 引き分けなどの場合
        earnedGold = 10;
    }

    const gameRecord = {
        date: new Date(), 
        opponent: "オンライン対戦", 
        moves: moveCount,
        result: isWin ? "WIN" : "LOSE", 
        mode: "online", 
        kifuData: kifu 
    };

    if (typeof updateMissionProgress === "function") {
      // 1. 「対局する」ミッションの進行 (+1回)
      updateMissionProgress("play", 1);

      // 2. 「勝利する」ミッションの進行 (勝った場合のみ +1回)
      if (isWin) {
          updateMissionProgress("win", 1);
      }
  }

    // Firestoreの更新処理
    db.collection("users").doc(user.uid).update({
        win: firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
        lose: firebase.firestore.FieldValue.increment(isWin ? 0 : 1),
        history: firebase.firestore.FieldValue.arrayUnion(gameRecord),
        // ★追加：所持金を増やす
        gold: firebase.firestore.FieldValue.increment(earnedGold)
    }).then(() => {
        console.log(`戦績保存完了: ${earnedGold}G 獲得`);
        
        // ★追加：画面に獲得金額を表示する演出
        if (statusDiv) {
            const msg = isWin ? "勝利ボーナス" : "参加報酬";
            const color = isWin ? "#ffd700" : "#cccccc"; // 金色 / 灰色
            // 既存のメッセージの下に追加表示
            const rewardMsg = document.createElement("div");
            rewardMsg.style.fontWeight = "bold";
            rewardMsg.style.color = "#d32f2f"; // 目立つ赤色などで
            rewardMsg.style.marginTop = "5px";
            rewardMsg.innerHTML = `<span style="background:${color}; padding:2px 5px; border-radius:3px;">${msg}</span> ${earnedGold}G GET!`;
            statusDiv.appendChild(rewardMsg);
        }
    }).catch(console.error);
}
function toggleKifu() {
    const area = document.getElementById("kifuArea");
    area.style.display = (area.style.display === "none") ? "flex" : "none";
    if (area.style.display === "flex") {
        const scrollBox = document.getElementById("kifu");
        if (scrollBox) setTimeout(() => { scrollBox.scrollTop = scrollBox.scrollHeight; }, 50);
    }
}
function copyKifuText() {
    const kifuDiv = document.getElementById("kifu");
    if (kifuDiv) navigator.clipboard.writeText(kifuDiv.innerText).then(() => alert("コピーしました"));
}
function toggleVolume() { document.getElementById("volumeModal").style.display = "flex"; }
function closeVolumeModal() { document.getElementById("volumeModal").style.display = "none"; }
function updateVolume() {
    const bgm = document.getElementById("bgm");
    const range = document.getElementById("bgmRange");
    if (bgm && range) { bgm.volume = range.value; bgm.muted = false; }
}
function showRules() { document.getElementById("rulesModal").style.display = "flex"; }
function closeRulesModal() { document.getElementById("rulesModal").style.display = "none"; }
function toggleMenu() {
    const panel = document.getElementById('menuPanel');
    panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
}
function resolvePromotion(doPromote) {
    document.getElementById("promoteModal").style.display = "none";
    if (pendingMove) {
        executeMove(pendingMove.sel, pendingMove.x, pendingMove.y, doPromote);
        pendingMove = null;
    }
}
function updateHandLayout(role) {
    const leftSide = document.querySelector(".side.left");
    const rightSide = document.querySelector(".side.right");
    const blackBox = document.getElementById("blackHandBox");
    const whiteBox = document.getElementById("whiteHandBox");
    if (!leftSide || !rightSide || !blackBox || !whiteBox) return;
    if (role === "white") { leftSide.prepend(blackBox); rightSide.appendChild(whiteBox); }
    else { leftSide.prepend(whiteBox); rightSide.appendChild(blackBox); }
}
function resetGame() {
    hasShownEndEffect = false; turn = "black"; gameOver = false; winner = null; moveCount = 0;
    kifu = []; history = []; lastMoveFrom = null;
    p1SkillCount = 0; p2SkillCount = 0; window.skillUsed = false; lastSkillKifu = "";
    remainingTime = { black: 1200, white: 1200 };
    boardState = JSON.parse(JSON.stringify(INITIAL_BOARD_CONST));
    hands = { black: [], white: [] };
    pieceStyles = Array(9).fill(null).map(() => Array(9).fill(null));
    if (p1Skill && p1Skill.reset) p1Skill.reset();
    if (p2Skill && p2Skill.reset) p2Skill.reset();
    syncGlobalSkillState();
    statusDiv.textContent = "対局開始！";
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) resetBtn.remove();
    render(); startTimer();
}
function deepCopyState() {
    return {
        boardState: JSON.parse(JSON.stringify(boardState)), hands: JSON.parse(JSON.stringify(hands)),
        turn: turn, moveCount: moveCount, kifu: JSON.parse(JSON.stringify(kifu)),
        p1SkillCount: p1SkillCount, p2SkillCount: p2SkillCount,
        lastMoveTo: lastMoveTo ? { ...lastMoveTo } : null,
        lastMoveFrom: lastMoveFrom ? { ...lastMoveFrom } : null
    };
}
function undoMove() {
    if (!history || history.length < 2) return;
    const prev = history[history.length - 2];
    history.length -= 2; lastMoveFrom = null;
    boardState = JSON.parse(JSON.stringify(prev.boardState));
    hands = JSON.parse(JSON.stringify(prev.hands));
    turn = prev.turn; moveCount = prev.moveCount;
    kifu = JSON.parse(JSON.stringify(prev.kifu));
    if (prev.p1SkillCount !== undefined) p1SkillCount = prev.p1SkillCount;
    if (prev.p2SkillCount !== undefined) p2SkillCount = prev.p2SkillCount;
    pieceStyles = Array(9).fill(null).map(() => Array(9).fill(null));
}

// ★★★ 追加した重要関数 1: 技を使った後の処理 ★★★
function processSkillAfterEffect(skillObj, result, playerColor) {
    history.push(deepCopyState());
    const boardTable = document.getElementById("board");
    if (boardTable) boardTable.classList.remove("skill-targeting-mode");

    if (result !== "SYSTEM") {
        const endsTurn = (skillObj.endsTurn !== false);
        if (endsTurn) {
            kifu.push(""); kifu[kifu.length - 1] = result;
            moveCount++; 
            if (playerColor === "black") p1SkillCount++; else p2SkillCount++;
            turn = (turn === "black" ? "white" : "black");
        } else {
            const movePart = result.split("：")[1] || result;
            lastSkillKifu = movePart; 
            if (playerColor === "black") p1SkillCount++; else p2SkillCount++;
        }
    }
    
    lastMoveTo = null;
    if (moveSound) { moveSound.currentTime = 0; moveSound.play().catch(() => {}); }
    if (skillObj.reset) skillObj.reset();
    isSkillTargeting = false;
    legalMoves = [];
    selected = null;
    syncGlobalSkillState();
    render();
    if (typeof showKifu === "function") showKifu();
    startTimer();
}

// ★★★ 追加した重要関数 2: 勝敗・終了時の演出 ★★★
function playGameEndEffect(winnerColor) {
    const cutInImg = document.getElementById("skillCutIn");
    let imgPath, audioPath;

    if (winnerColor === myRole) {
        imgPath = "script/image/shori.PNG";
        audioPath = "script/audio/shori.mp3";
    } else {
        imgPath = "script/image/haiboku.PNG";
        audioPath = "script/audio/haiboku.mp3";
    }

    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play().catch(e => {});

    if (cutInImg) {
        cutInImg.src = imgPath;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth; 
        cutInImg.classList.add("cut-in-active");
        
        setTimeout(() => { 
            cutInImg.classList.remove("cut-in-active"); 
        }, 3000);
    }
}

// ★★★ 追加した重要関数 3: 必殺技カットイン演出 ★★★
function playSkillCutIn(playerColor) {
    const charId = (playerColor === 'black') 
        ? sessionStorage.getItem('online_black_char') 
        : sessionStorage.getItem('online_white_char');

    // 画像URLの取得
    const src = getImageUrlById(charId) ? getImageUrlById(charId).replace('url("', '').replace('")', '') : "";
    
    // スキル用効果音（なければmoveSoundなどで代用も可）
    const audio = new Audio("script/audio/move.mp3"); 
    audio.play().catch(()=>{});

    const cutInImg = document.getElementById("skillCutIn");
    if(cutInImg && src) {
        cutInImg.src = src;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth;
        cutInImg.classList.add("cut-in-active");
        setTimeout(() => cutInImg.classList.remove("cut-in-active"), 2000);
    }
}

const INITIAL_BOARD_CONST = [
    ["l", "n", "s", "g", "k", "g", "s", "n", "l"], ["", "r", "", "", "", "", "", "b", ""],
    ["p", "p", "p", "p", "p", "p", "p", "p", "p"], ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P", "P"], ["", "B", "", "", "", "", "", "R", ""],
    ["L", "N", "S", "G", "K", "G", "S", "N", "L"]
];


// ★★★ main_player.js と同じ演出関数を追加 ★★★
window.playSkillEffect = function(imageName, soundName, flashColor) {
    // 1. カットイン画像の表示
    const img = document.getElementById("skillCutIn");
    if (img && imageName) {
        img.src = "script/image/" + imageName;
        img.classList.remove("cut-in-active");
        void img.offsetWidth; // リフロー発生（アニメーションリセット用）
        img.classList.add("cut-in-active");
        
        // 3秒後にクラスを消す（念のため）
        setTimeout(() => { 
            if(img) img.classList.remove("cut-in-active"); 
        }, 3000);
    }

    // 2. 音声再生（配列対応）
    if (soundName) {
        if (Array.isArray(soundName)) {
            soundName.forEach(name => {
                const a = new Audio("script/audio/" + name);
                a.volume = 1.0; // 音量調整
                a.play().catch(e => {});
            });
        } else {
            const audio = document.getElementById("skillSound") || new Audio("script/audio/" + soundName);
            audio.src = "script/audio/" + soundName;
            audio.volume = 1.0;
            audio.play().catch(e => {});
        }
    }

    // 3. 盤面のフラッシュ演出
    const boardTable = document.getElementById("board");
    if (boardTable && flashColor) {
        // 既存のフラッシュクラスを削除
        boardTable.classList.remove("flash-green", "flash-orange", "flash-silver", "flash-red", "flash-blue");
        void boardTable.offsetWidth; // リフロー
        boardTable.classList.add("flash-" + flashColor);
        
        // 2秒後にフラッシュを消す
        setTimeout(() => {
            if (boardTable) boardTable.classList.remove("flash-" + flashColor);
        }, 2000);
    }
};

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

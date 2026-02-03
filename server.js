const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = './chat_history.json';

// ★設定：持ち時間（秒） 20分 = 1200秒
const TIME_LIMIT = 1200;

app.use(express.static('public'));

let games = {}; 
let playerCharIds = {}; 
let waitingQueue = []; 

let chatHistory = [];
if (fs.existsSync(DATA_FILE)) {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        chatHistory = JSON.parse(data);
        console.log(`★チャット履歴読込: ${chatHistory.length}件`);
    } catch (e) {}
}

const INITIAL_BOARD = [
    ["l", "n", "s", "g", "k", "g", "s", "n", "l"],
    ["", "r", "", "", "", "", "", "b", ""],
    ["p", "p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P", "P"],
    ["", "B", "", "", "", "", "", "R", ""],
    ["L", "N", "S", "G", "K", "G", "S", "N", "L"]
];

io.on('connection', (socket) => {
    console.log('接続: ' + socket.id);
    socket.emit('chat history', chatHistory);

    socket.on('declare character', (charId) => {
        playerCharIds[socket.id] = charId;
        const roomId = socket.roomId;
        const userId = socket.userId;
        
        if (roomId && games[roomId]) {
            const game = games[roomId];
            if (game.status === 'playing') return; // 対局中は変更不可

            let changed = false;
            if (game.players.black === userId) { game.blackCharId = charId; changed = true; }
            if (game.players.white === userId) { game.whiteCharId = charId; changed = true; }

            if (changed) sendRoomUpdate(roomId);
        }
    });
    
    socket.on('check reconnection', (roomId, callback) => {
        if (games[roomId]) callback({ canReconnect: true, status: games[roomId].status });
        else callback({ canReconnect: false });
    });

    socket.on('request room list', () => {
        const roomList = [];
        for (const [roomId, game] of Object.entries(games)) {
            let status = "待機中";
            if (game.isGameOver) status = "終局";
            else if (game.status === 'playing') status = "対局中";
            
            let count = 0;
            if (game.players.black) count++;
            if (game.players.white) count++;
            roomList.push({ roomId, status, userCount: count });
        }
        socket.emit('room list', roomList);
    });

    socket.on('join random queue', (userId) => {
        waitingQueue = waitingQueue.filter(user => user.userId !== userId);
        socket.userId = userId;
        waitingQueue.push({ socketId: socket.id, userId: userId });

        if (waitingQueue.length >= 2) {
            const p1 = waitingQueue.shift();
            const p2 = waitingQueue.shift();
            const autoRoomId = `rank_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            io.to(p1.socketId).emit('match found', autoRoomId);
            io.to(p2.socketId).emit('match found', autoRoomId);
        }
    });

    socket.on('leave random queue', () => {
        waitingQueue = waitingQueue.filter(u => u.socketId !== socket.id);
    });

    socket.on('enter game', (data) => {
        let roomId, userId, userCharId;
        if (typeof data === 'object') { roomId = data.roomId; userId = data.userId; userCharId = data.charId; }
        else { roomId = data || "default"; userId = 'guest_' + socket.id; userCharId = 'default'; }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.userId = userId;

        if (userCharId) playerCharIds[socket.id] = userCharId;

        if (!games[roomId]) {
            console.log(`部屋作成: ${roomId}`);
            games[roomId] = {
                boardState: JSON.parse(JSON.stringify(INITIAL_BOARD)),
                hands: { black: [], white: [] },
                turn: "black",
                moveCount: 0,
                kifu: [],
                players: { black: null, white: null },
                ready: { black: false, white: false },
                status: 'waiting',
                blackCharId: 'default',
                whiteCharId: 'default',
                p1SkillCount: 0,
                p2SkillCount: 0,
                isGameOver: false,
                
                // ★追加：時間管理用変数
                remainingTime: { black: TIME_LIMIT, white: TIME_LIMIT }, // 残り時間(秒)
                lastMoveTime: null, // 最後に手が指された時刻
                timerId: null       // サーバー上のタイマーID
            };
        }

        const game = games[roomId];
        let myRole = "spectator";
        if (game.players.black === userId) myRole = "black";
        else if (game.players.white === userId) myRole = "white";
        else if (game.players.black === null) { game.players.black = userId; myRole = "black"; }
        else if (game.players.white === null) { game.players.white = userId; myRole = "white"; }

        const incomingCharId = playerCharIds[socket.id] || userCharId || 'default';
        if (myRole === 'black' && game.blackCharId === 'default') game.blackCharId = incomingCharId;
        if (myRole === 'white' && game.whiteCharId === 'default') game.whiteCharId = incomingCharId;

        socket.emit('role assigned', myRole); 
        
        setTimeout(() => {
            // ★重要：復帰時に正しい時間を送る
            // 現在の手番の人は、サーバー上のremainingTimeから「最後に動いてからの経過時間」を引いて表示する必要がある
            const currentData = JSON.parse(JSON.stringify(game));
            if (game.status === 'playing' && game.lastMoveTime) {
                const now = Date.now();
                const elapsed = Math.floor((now - game.lastMoveTime) / 1000);
                // 表示用に計算して送る（サーバーの実データはまだ減らさない）
                currentData.remainingTime[game.turn] = Math.max(0, game.remainingTime[game.turn] - elapsed);
            }
            // 不要なプロパティ（timerIdなど）は送らない方が安全だが、今回は簡易実装のためそのまま
            socket.emit('restore game', currentData); 
            sendRoomUpdate(roomId);
        }, 50);
    });

    socket.on('toggle ready', () => {
        const roomId = socket.roomId;
        const userId = socket.userId;
        if (!roomId || !games[roomId]) return;

        const game = games[roomId];
        let role = null;
        if (game.players.black === userId) role = 'black';
        if (game.players.white === userId) role = 'white';

        if (role) {
            game.ready[role] = !game.ready[role];
            sendRoomUpdate(roomId);

            if (game.players.black && game.players.white && game.ready.black && game.ready.white) {
                console.log(`部屋[${roomId}] ゲーム開始！`);
                game.status = 'playing';
                
                // ★追加：対局開始時にタイマー始動（先手の時間消費開始）
                game.lastMoveTime = Date.now();
                startServerTimer(roomId, "black"); // 先手番の監視開始

                io.to(roomId).emit('all ready'); 
            }
        }
    });

    function sendRoomUpdate(roomId) {
        if (!games[roomId]) return;
        const game = games[roomId];
        const roomInfo = {
            blackId: game.players.black,
            whiteId: game.players.white,
            blackReady: game.ready.black,
            whiteReady: game.ready.white,
            blackChar: game.blackCharId,
            whiteChar: game.whiteCharId,
            status: game.status
        };
        io.to(roomId).emit('update room status', roomInfo);
    }

    socket.on('shogi move', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !games[roomId]) return;
        const game = games[roomId];

        // ★追加：時間消費の確定処理
        if (game.status === 'playing' && game.lastMoveTime) {
            // 前の手番の人（今動かした人）の時間を減らす
            const now = Date.now();
            const elapsed = Math.floor((now - game.lastMoveTime) / 1000);
            game.remainingTime[game.turn] -= elapsed;
            
            // もし通信ラグ等で0以下になっていたら負けにする
            if (game.remainingTime[game.turn] <= 0) {
                game.remainingTime[game.turn] = 0;
                handleTimeUp(roomId, game.turn);
                return; // 移動処理はしない
            }
        }

        socket.to(roomId).emit('shogi move', data);

        if (data.gameState) {
            const clientGame = data.gameState;
            game.boardState = clientGame.boardState;
            game.hands = clientGame.hands;
            // turnはここで切り替わる
            game.turn = clientGame.turn; 
            game.moveCount = clientGame.moveCount;
            game.kifu = clientGame.kifu;
            
            if (clientGame.p1SkillCount !== undefined) game.p1SkillCount = clientGame.p1SkillCount;
            if (clientGame.p2SkillCount !== undefined) game.p2SkillCount = clientGame.p2SkillCount;

            if (clientGame.isGameOver !== undefined) {
                game.isGameOver = clientGame.isGameOver;
                stopServerTimer(roomId); // 終局ならタイマーストップ
            } else {
                // ★追加：次の手番のためのタイマーセット
                game.lastMoveTime = Date.now();
                startServerTimer(roomId, game.turn);
                
                // 全員に「今の残り時間」を同期（ズレ補正のため）
                io.to(roomId).emit('sync time', game.remainingTime);
            }
        }
    });

    socket.on('skill activate', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !games[roomId]) return;
        socket.to(roomId).emit('skill activate', data);
        
        // ★注意：スキルで手番が変わる場合も考慮が必要だが、
        // 現状の仕様では「shogi move」が必ずセットで送られてくる（TimeWarp含む）ため、
        // 時間計算は shogi move 側で行えばOK。
        // もし手番が変わるスキルがあればここで turn を更新。
        if (games[roomId]) games[roomId].turn = (data.turn === 'black' ? 'white' : 'black');
    });

    socket.on('game reset', () => { 
        const roomId = socket.roomId;
        if (!roomId || !games[roomId]) return;
        
        stopServerTimer(roomId); // タイマー停止

        games[roomId].boardState = JSON.parse(JSON.stringify(INITIAL_BOARD));
        games[roomId].hands = { black: [], white: [] };
        games[roomId].turn = "black";
        games[roomId].moveCount = 0;
        games[roomId].kifu = [];
        games[roomId].p1SkillCount = 0;
        games[roomId].p2SkillCount = 0;
        games[roomId].isGameOver = false;
        
        // ★時間をリセット
        games[roomId].remainingTime = { black: TIME_LIMIT, white: TIME_LIMIT };
        games[roomId].lastMoveTime = null;
        
        io.to(roomId).emit('game reset');
        setTimeout(() => { io.to(roomId).emit('game start', games[roomId]); }, 500);
    });
    
    socket.on('game resign', (data) => {
        const roomId = socket.roomId;
        if(!roomId || !games[roomId]) return;
        stopServerTimer(roomId); // タイマー停止
        
        socket.to(roomId).emit('game resign', data);
        games[roomId].isGameOver = true;
        games[roomId].status = 'finished';
        scheduleRoomCleanup(roomId);
    });

    socket.on('game over', () => {
        const roomId = socket.roomId;
        if(!roomId || !games[roomId]) return;
        stopServerTimer(roomId); // タイマー停止

        games[roomId].isGameOver = true;
        games[roomId].status = 'finished';
        scheduleRoomCleanup(roomId);
    });

    socket.on('chat message', (data) => {
        chatHistory.push(data);
        if (chatHistory.length > 100) chatHistory.shift();
        fs.writeFileSync(DATA_FILE, JSON.stringify(chatHistory, null, 2));
        io.emit('chat message', data);
    });

    socket.on('disconnect', () => {
        waitingQueue = waitingQueue.filter(u => u.socketId !== socket.id);
        delete playerCharIds[socket.id];

        const roomId = socket.roomId;
        const userId = socket.userId;
        if (!roomId || !games[roomId]) return;

        const game = games[roomId];

        if (game.status === 'waiting') {
            if (game.players.black === userId) game.ready.black = false;
            if (game.players.white === userId) game.ready.white = false;
            sendRoomUpdate(roomId);
        }

        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (!roomSockets || roomSockets.size === 0) {
            // 全員いなくなってもタイマーは止めない！これがズル防止策。
            // ただし、勝負がついた後や開始前なら消す。
            if (game.isGameOver) {
                 setTimeout(() => {
                     const checkSockets = io.sockets.adapter.rooms.get(roomId);
                     if ((!checkSockets || checkSockets.size === 0) && games[roomId]) {
                         stopServerTimer(roomId); // 削除前には止める
                         delete games[roomId];
                     }
                 }, 30000); 
            } 
            else if (game.moveCount === 0) {
                stopServerTimer(roomId);
                delete games[roomId];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`★Server running: http://localhost:${PORT}`);
});

// --- タイマー管理関数 ---

function startServerTimer(roomId, currentTurn) {
    if (!games[roomId]) return;
    const game = games[roomId];

    // 既存のタイマーがあれば消す
    if (game.timerId) clearTimeout(game.timerId);

    // その人の残り時間を取得
    const timeLeft = game.remainingTime[currentTurn];

    // 時間切れになるタイミングで発火するタイマーをセット
    // ※Node.jsのsetTimeoutはこれで、接続が切れても回り続けます
    game.timerId = setTimeout(() => {
        handleTimeUp(roomId, currentTurn);
    }, timeLeft * 1000);
}

function stopServerTimer(roomId) {
    if (games[roomId] && games[roomId].timerId) {
        clearTimeout(games[roomId].timerId);
        games[roomId].timerId = null;
    }
}

function handleTimeUp(roomId, loserRole) {
    if (!games[roomId]) return;
    const game = games[roomId];

    // 時間切れ処理
    console.log(`部屋[${roomId}] ${loserRole}の時間切れ負け`);
    game.isGameOver = true;
    game.status = 'finished';
    game.remainingTime[loserRole] = 0;

    // クライアントへ通知
    io.to(roomId).emit('game resign', { 
        loser: loserRole, 
        reason: "timeout" // 理由：時間切れ
    });
    
    stopServerTimer(roomId);
    scheduleRoomCleanup(roomId);
}

function scheduleRoomCleanup(roomId) {
    if (games[roomId] && games[roomId].cleanupTimer) return;
    const timer = setTimeout(() => {
        if (games[roomId]) {
            io.to(roomId).emit('force room close');
            delete games[roomId];
        }
    }, 3600000); 
    if (games[roomId]) {
        games[roomId].cleanupTimer = timer;
    }
}

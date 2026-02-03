const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = './chat_history.json';

app.use(express.static('public'));

// --- ゲーム管理変数 ---
let games = {}; 
let playerCharIds = {}; 
let waitingQueue = []; 
// ★削除: disconnectTimers 変数を削除しました

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
        console.log(`キャラ登録: Socket[${socket.id}] -> ${charId}`);
        playerCharIds[socket.id] = charId;

        const roomId = socket.roomId;
        const userId = socket.userId;
        
        if (roomId && games[roomId]) {
            const game = games[roomId];
            let changed = false;

            if (game.players.black === userId) {
                game.blackCharId = charId;
                changed = true;
            }
            if (game.players.white === userId) {
                game.whiteCharId = charId;
                changed = true;
            }

            if (changed) {
                console.log(`部屋[${roomId}]のキャラ情報を更新: ${charId}`);
                sendRoomUpdate(roomId);
            }
        }
    });
    
    // 再接続チェック（statusを返すだけ）
    socket.on('check reconnection', (roomId, callback) => {
        if (games[roomId]) {
            callback({ canReconnect: true, status: games[roomId].status });
        } else {
            callback({ canReconnect: false });
        }
    });

    // --- ロビー: 部屋一覧 ---
    socket.on('request room list', () => {
        const roomList = [];
        for (const [roomId, game] of Object.entries(games)) {
            let status = "待機中";
            let count = 0;
            if (game.players.black) count++;
            if (game.players.white) count++;

            if (game.isGameOver) status = "終局";
            else if (game.status === 'playing') status = "対局中";

            roomList.push({ roomId, status, userCount: count });
        }
        socket.emit('room list', roomList);
    });

    // --- ランダムマッチ ---
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

    // --- 入室処理 ---
    socket.on('enter game', (data) => {
        let roomId, userId, userCharId;
        if (typeof data === 'object') { 
            roomId = data.roomId; 
            userId = data.userId; 
            userCharId = data.charId;
        } else { 
            roomId = data || "default"; 
            userId = 'guest_' + socket.id; 
            userCharId = 'default';
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.userId = userId;

        if (userCharId) {
            console.log(`入室と同時にキャラ登録: ${userId} -> ${userCharId}`);
            playerCharIds[socket.id] = userCharId;
        }

        // 新規作成
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
                isGameOver: false
            };
        }

        const game = games[roomId];

        // ★削除: ここにあった「切断タイマー解除処理」を削除しました。
        // タイマーが存在しないので、解除する必要もありません。

        // 席の割り当て
        let myRole = "spectator";
        if (game.players.black === userId) myRole = "black";
        else if (game.players.white === userId) myRole = "white";
        else if (game.players.black === null) { game.players.black = userId; myRole = "black"; }
        else if (game.players.white === null) { game.players.white = userId; myRole = "white"; }

        const charId = playerCharIds[socket.id] || userCharId || 'default';
        if (myRole === 'black') game.blackCharId = charId;
        if (myRole === 'white') game.whiteCharId = charId;

        socket.emit('role assigned', myRole); 
        
        setTimeout(() => {
            socket.emit('restore game', game); 
            sendRoomUpdate(roomId);
        }, 50);
    });

    // --- 準備完了トグル ---
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

    // --- ゲーム操作 ---
    socket.on('shogi move', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !games[roomId]) return;
        
        socket.to(roomId).emit('shogi move', data);

        if (data.gameState) {
            const serverGame = games[roomId];
            const clientGame = data.gameState;

            serverGame.boardState = clientGame.boardState;
            serverGame.hands = clientGame.hands;
            serverGame.turn = clientGame.turn;
            serverGame.moveCount = clientGame.moveCount;
            serverGame.kifu = clientGame.kifu;
            
            // スキル回数も同期
            if (clientGame.p1SkillCount !== undefined) serverGame.p1SkillCount = clientGame.p1SkillCount;
            if (clientGame.p2SkillCount !== undefined) serverGame.p2SkillCount = clientGame.p2SkillCount;

            if (clientGame.isGameOver !== undefined) {
                serverGame.isGameOver = clientGame.isGameOver;
            }
        }
    });

    socket.on('skill activate', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !games[roomId]) return;
        socket.to(roomId).emit('skill activate', data);
        if (games[roomId]) games[roomId].turn = (data.turn === 'black' ? 'white' : 'black');
    });

    socket.on('game reset', () => { 
        const roomId = socket.roomId;
        if (!roomId || !games[roomId]) return;
        
        games[roomId].boardState = JSON.parse(JSON.stringify(INITIAL_BOARD));
        games[roomId].hands = { black: [], white: [] };
        games[roomId].turn = "black";
        games[roomId].moveCount = 0;
        games[roomId].kifu = [];
        games[roomId].p1SkillCount = 0;
        games[roomId].p2SkillCount = 0;
        games[roomId].isGameOver = false;
        
        io.to(roomId).emit('game reset');
        setTimeout(() => { io.to(roomId).emit('game start', games[roomId]); }, 500);
    });
    
    socket.on('game resign', (data) => {
        const roomId = socket.roomId;
        if(!roomId || !games[roomId]) return;
        socket.to(roomId).emit('game resign', data);
        games[roomId].isGameOver = true;
        games[roomId].status = 'finished';
        scheduleRoomCleanup(roomId);
    });

    socket.on('game over', () => {
        const roomId = socket.roomId;
        if(!roomId || !games[roomId]) return;
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

    // --- 切断処理 ---
    socket.on('disconnect', () => {
        console.log('切断: ' + socket.id);
        waitingQueue = waitingQueue.filter(u => u.socketId !== socket.id);
        delete playerCharIds[socket.id];

        const roomId = socket.roomId;
        const userId = socket.userId;
        if (!roomId || !games[roomId]) return;

        const game = games[roomId];

        // 待機中ならReady解除
        if (game.status === 'waiting') {
            if (game.players.black === userId) game.ready.black = false;
            if (game.players.white === userId) game.ready.white = false;
            sendRoomUpdate(roomId);
        }

        // ★削除: ここにあった「対局中の切断タイマー処理（負け判定）」を完全に削除しました。
        // 対局中に切断しても、部屋はそのまま維持されます。
        // 戻ってくれば再開できます。

        // 即座の部屋削除判定（誰もいなくなった場合の掃除）
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (!roomSockets || roomSockets.size === 0) {
            
            // 勝負がついた後なら削除予約（既存ロジック）
            if (game.isGameOver) {
                 console.log(`部屋[${roomId}] 全員退出。0.5分後に削除予約。`);
                 setTimeout(() => {
                     const checkSockets = io.sockets.adapter.rooms.get(roomId);
                     if ((!checkSockets || checkSockets.size === 0) && games[roomId]) {
                         console.log(`部屋削除(遅延実行): ${roomId}`);
                         delete games[roomId];
                     }
                 }, 30000); // 30秒
            } 
            // ゲーム開始前（0手目）なら即削除
            else if (game.moveCount === 0) {
                console.log(`部屋削除: ${roomId}`);
                delete games[roomId];
            }
            // ★注意: ゲーム中(moveCount > 0)で全員いなくなった場合は、
            // 部屋は削除されずに残ります（いつでも再開できるようにするため）。
            // 1時間後の強制削除(scheduleRoomCleanup)は機能しないため、
            // サーバー再起動までメモリに残りますが、バグ回避を優先します。
        }
    });
});

server.listen(PORT, () => {
    console.log(`★Server running: http://localhost:${PORT}`);
});

// server.js 内の適当な場所に、この関数を追加
function scheduleRoomCleanup(roomId) {
    if (games[roomId] && games[roomId].cleanupTimer) return;

    console.log(`部屋[${roomId}] 終局。1時間後に強制解散します。`);

    const timer = setTimeout(() => {
        if (games[roomId]) {
            console.log(`部屋[${roomId}] 時間切れのため強制削除`);
            
            io.to(roomId).emit('force room close');
            
            delete games[roomId];
            // ★削除: disconnectTimers の削除処理も不要なので削除
        }
    }, 3600000); // 1時間

    if (games[roomId]) {
        games[roomId].cleanupTimer = timer;
    }
}

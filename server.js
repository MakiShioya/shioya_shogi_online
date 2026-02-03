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

    // --- キャラクター変更要求 ---
    socket.on('declare character', (charId) => {
        console.log(`キャラ登録要求: Socket[${socket.id}] -> ${charId}`);
        playerCharIds[socket.id] = charId;

        const roomId = socket.roomId;
        const userId = socket.userId;
        
        if (roomId && games[roomId]) {
            const game = games[roomId];
            
            // ★修正：対局中(playing)なら、キャラ変更は絶対に許可しない
            if (game.status === 'playing') {
                console.log(`対局中のためキャラ変更を拒否: Room[${roomId}]`);
                return;
            }

            let changed = false;

            // 待機中なら変更を許可しても良いが、ここでもロックしたい場合は
            // 下記のif文に `&& game.blackCharId === 'default'` を追加すれば完璧なロックになります。
            // 今回は「対局中の変更禁止」を優先して実装しています。

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
    
    // 再接続チェック
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

    // --- 入室処理 (ここでキャラ固定を行う) ---
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

        // 一応メモリには入れておくが、ゲームへの適用は慎重に行う
        if (userCharId) {
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
                blackCharId: 'default', // ★ここが「空」の状態
                whiteCharId: 'default',
                p1SkillCount: 0,
                p2SkillCount: 0,
                isGameOver: false
            };
        }

        const game = games[roomId];

        // 席の割り当て
        let myRole = "spectator";
        if (game.players.black === userId) myRole = "black";
        else if (game.players.white === userId) myRole = "white";
        else if (game.players.black === null) { game.players.black = userId; myRole = "black"; }
        else if (game.players.white === null) { game.players.white = userId; myRole = "white"; }

        // ★★★ 修正ポイント：キャラクター情報の固定ロジック ★★★
        // クライアントから送られてきたキャラID (incomingCharId)
        const incomingCharId = playerCharIds[socket.id] || userCharId || 'default';

        if (myRole === 'black') {
            // まだ誰も設定していない('default')なら、今回入ってきた情報で固定する
            if (game.blackCharId === 'default') {
                game.blackCharId = incomingCharId;
                console.log(`部屋[${roomId}] 先手キャラ確定: ${incomingCharId}`);
            } else {
                // すでに設定されているなら、入ってきた情報は無視してサーバーの情報を優先
                console.log(`部屋[${roomId}] 先手キャラ固定済み(${game.blackCharId})。上書き拒否。`);
            }
        }
        
        if (myRole === 'white') {
            // 後手も同様
            if (game.whiteCharId === 'default') {
                game.whiteCharId = incomingCharId;
                console.log(`部屋[${roomId}] 後手キャラ確定: ${incomingCharId}`);
            } else {
                console.log(`部屋[${roomId}] 後手キャラ固定済み(${game.whiteCharId})。上書き拒否。`);
            }
        }

        socket.emit('role assigned', myRole); 
        
        // クライアントへは「サーバーで確定しているキャラ情報」を送り返す
        // これでクライアント側の表示がサーバーと同期される
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
        
        // ★リセット時はキャラ固定を維持するか、解除するか？
        // 今回は「部屋に居座る限りキャラはそのまま」とするため、
        // blackCharId / whiteCharId は初期化しません。
        
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

        if (game.status === 'waiting') {
            if (game.players.black === userId) game.ready.black = false;
            if (game.players.white === userId) game.ready.white = false;
            sendRoomUpdate(roomId);
        }

        // 即座の部屋削除判定（誰もいなくなった場合の掃除）
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (!roomSockets || roomSockets.size === 0) {
            
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
            else if (game.moveCount === 0) {
                console.log(`部屋削除: ${roomId}`);
                delete games[roomId];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`★Server running: http://localhost:${PORT}`);
});

function scheduleRoomCleanup(roomId) {
    if (games[roomId] && games[roomId].cleanupTimer) return;

    console.log(`部屋[${roomId}] 終局。1時間後に強制解散します。`);

    const timer = setTimeout(() => {
        if (games[roomId]) {
            console.log(`部屋[${roomId}] 時間切れのため強制削除`);
            io.to(roomId).emit('force room close');
            delete games[roomId];
        }
    }, 3600000); 

    if (games[roomId]) {
        games[roomId].cleanupTimer = timer;
    }
}

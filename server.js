// server.js (修正版：状態管理の安全性向上 + 接続タイミング修正)
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
let disconnectTimers = {}; 

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

        // ★追加修正: すでに部屋に入っている場合、その部屋のキャラ情報も即座に更新する
        const roomId = socket.roomId;
        const userId = socket.userId;
        
        if (roomId && games[roomId]) {
            const game = games[roomId];
            let changed = false;

            // 自分が先手なら先手キャラを更新
            if (game.players.black === userId) {
                game.blackCharId = charId;
                changed = true;
            }
            // 自分が後手なら後手キャラを更新
            if (game.players.white === userId) {
                game.whiteCharId = charId;
                changed = true;
            }

            // 変更があったら部屋の全員に通知（これで画面が変わります）
            if (changed) {
                console.log(`部屋[${roomId}]のキャラ情報を更新: ${charId}`);
                sendRoomUpdate(roomId);
            }
        }
    });
    
    // --- ★追加機能：再接続チェック ---
    socket.on('check reconnection', (roomId, callback) => {
        // ★修正：isGameOverのチェックを外す
        if (games[roomId]) {
            // 状態（playing か finished か）も一緒に返す
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
    // --- 入室処理 ---
    socket.on('enter game', (data) => {
        let roomId, userId, userCharId; // ★変数を追加

        // データ受け取り部分を拡張
        if (typeof data === 'object') { 
            roomId = data.roomId; 
            userId = data.userId; 
            userCharId = data.charId; // ★データからキャラIDを取り出す
        } else { 
            roomId = data || "default"; 
            userId = 'guest_' + socket.id; 
            userCharId = 'default';
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.userId = userId;

        // ★重要修正: 送られてきたキャラIDがあれば、即座にサーバーのメモリ(playerCharIds)に登録する
        // これにより、この後の処理で「情報がないからdefault」になるのを防ぐ
        if (userCharId) {
            console.log(`入室と同時にキャラ登録: ${userId} -> ${userCharId}`);
            playerCharIds[socket.id] = userCharId;
        }

        // 新規作成
        if (!games[roomId]) {
            console.log(`部屋作成: ${roomId}`);
            games[roomId] = {
                // ★ここから下をすべてコピーして貼り付けてください（省略なしの完全版です）
                boardState: JSON.parse(JSON.stringify(INITIAL_BOARD)),
                hands: { black: [], white: [] },
                turn: "black",
                moveCount: 0,
                kifu: [],
                players: { black: null, white: null }, // ★エラーの原因はここが消えていたことです！
                ready: { black: false, white: false },
                status: 'waiting',
                
                // 初期値はdefaultですが、この直後の処理で正しいキャラIDに上書きされます
                blackCharId: 'default',
                whiteCharId: 'default',
                
                p1SkillCount: 0,
                p2SkillCount: 0,
                isGameOver: false
            };
        }

        const game = games[roomId];

        // 切断タイマー解除
        if (disconnectTimers[roomId]) {
            if (game.players.black === userId && disconnectTimers[roomId].black) {
                console.log(`先手(${userId})復帰。タイマー解除。`);
                clearTimeout(disconnectTimers[roomId].black);
                delete disconnectTimers[roomId].black;
            }
            if (game.players.white === userId && disconnectTimers[roomId].white) {
                console.log(`後手(${userId})復帰。タイマー解除。`);
                clearTimeout(disconnectTimers[roomId].white);
                delete disconnectTimers[roomId].white;
            }
        }

        // 席の割り当て
        let myRole = "spectator";
        if (game.players.black === userId) myRole = "black";
        else if (game.players.white === userId) myRole = "white";
        else if (game.players.black === null) { game.players.black = userId; myRole = "black"; }
        else if (game.players.white === null) { game.players.white = userId; myRole = "white"; }

        // ★ここが元凶だった箇所の修正★
        // playerCharIds[socket.id] を参照するが、さっき登録したので確実に入っているはず。
        // 万が一無ければ default になるが、基本的には送られてきた userCharId が使われる。
        const charId = playerCharIds[socket.id] || userCharId || 'default';
        
        // 自分の役割のキャラIDを確実に更新する
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

        // ★修正点①: 状態の丸書き込みを廃止し、必要なデータのみ更新する
        // これにより、players情報やキャラID、切断状態などが誤って上書きされるのを防ぎます。
        if (data.gameState) {
            const serverGame = games[roomId];
            const clientGame = data.gameState;

            // 盤面に関する情報のみを安全にマージ
            serverGame.boardState = clientGame.boardState;
            serverGame.hands = clientGame.hands;
            serverGame.turn = clientGame.turn;
            serverGame.moveCount = clientGame.moveCount;
            serverGame.kifu = clientGame.kifu;
            
            // 勝敗がついている場合は更新（ただし、不正な上書き防止のためチェックを入れても良い）
            if (clientGame.isGameOver !== undefined) {
                serverGame.isGameOver = clientGame.isGameOver;
            }

            // 【重要】players, ready, status, charIds, timers などは絶対に上書きしない
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
        
        // リセット処理（簡易版）
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

        // 対局中なら切断タイマーセット
        if (game.status === 'playing' && !game.isGameOver) {
            if (!disconnectTimers[roomId]) disconnectTimers[roomId] = {};
            let role = null;
            if (game.players.black === userId) role = 'black';
            else if (game.players.white === userId) role = 'white';

            if (role) {
                console.log(`${role}(${userId}) 切断。2分タイマー開始。`);
                socket.to(roomId).emit('chat message', { text: "相手が切断しました。2分以内に復帰しないと勝利になります。", isSystem: true });
                
                disconnectTimers[roomId][role] = setTimeout(() => {
                    // まだゲームが終わってなければ
                    if (games[roomId] && !games[roomId].isGameOver) {
                        console.log(`時間切れ！ ${role} の通信切れ負け。`);
                        games[roomId].isGameOver = true;
                        games[roomId].status = 'finished';
                        io.to(roomId).emit('game resign', { loser: role, reason: "disconnect" });
                        delete disconnectTimers[roomId][role];

                        // 誰もいなければ部屋ごと削除
                        const roomSockets = io.sockets.adapter.rooms.get(roomId);
                        if (!roomSockets || roomSockets.size === 0) {
                            console.log(`無人部屋[${roomId}]を削除（タイマー後）`);
                            delete games[roomId];
                            delete disconnectTimers[roomId];
                        }
                    }
                }, 120000); // 2分
            }
        }

        // 即座の部屋削除判定（通常切断時）
        // server.js 切断処理の最後の方
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (!roomSockets || roomSockets.size === 0) {
            // ★修正：勝負がついていても、すぐには消さずに5分だけ猶予を与える
            // （これにより、ブラウザを閉じても5分以内なら結果画面に戻れるようになる）
            if (game.isGameOver) {
                 console.log(`部屋[${roomId}] 全員退出。5分後に削除予約。`);
                 setTimeout(() => {
                     // 5分後にまだ部屋があり、かつ無人なら削除
                     const checkSockets = io.sockets.adapter.rooms.get(roomId);
                     if ((!checkSockets || checkSockets.size === 0) && games[roomId]) {
                         console.log(`部屋削除(遅延実行): ${roomId}`);
                         delete games[roomId];
                     }
                 }, 300000); // 300000ms = 5分
            } 
            else if (game.moveCount === 0) {
                // 初期状態なら即削除でOK
                console.log(`部屋削除: ${roomId}`);
                delete games[roomId];
                if (disconnectTimers[roomId]) delete disconnectTimers[roomId];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`★Server running: http://localhost:${PORT}`);
});

// server.js 内の適当な場所に、この関数を追加
function scheduleRoomCleanup(roomId) {
    // すでにタイマーがセットされていれば何もしない（二重セット防止）
    if (games[roomId] && games[roomId].cleanupTimer) return;

    console.log(`部屋[${roomId}] 終局。1時間後に強制解散します。`);

    // 1時間 (3600000ms) 後に発火
    const timer = setTimeout(() => {
        if (games[roomId]) {
            console.log(`部屋[${roomId}] 時間切れのため強制削除`);
            
            // 部屋にいる全員に「時間切れだよ」と伝える
            io.to(roomId).emit('force room close');
            
            // データを削除
            delete games[roomId];
            if (disconnectTimers[roomId]) delete disconnectTimers[roomId];
        }
    }, 3600000); // 1時間（テスト時は 10000 = 10秒とかにすると分かりやすいです）

    if (games[roomId]) {
        games[roomId].cleanupTimer = timer;
    }
}


// server.js (キャラクター同期対応版)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// クラウド環境のポート対応
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// 接続しているプレイヤーを管理する変数
let connectedPlayers = {
    black: null, // 先手のSocket ID
    white: null  // 後手のSocket ID
};

// ★追加：各プレイヤーが選んだキャラクターIDを保存する辞書
let playerCharIds = {}; 

io.on('connection', (socket) => {
    console.log('誰かが接続しました: ' + socket.id);

    // ★追加：クライアントから「私はこのキャラです」と連絡が来たら保存する
    socket.on('declare character', (charId) => {
        playerCharIds[socket.id] = charId;
        console.log(`ID: ${socket.id} は ${charId} を選択しました`);
    });

    // 1. 役割割り当て（早い者勝ち）
    let myRole = null;

    if (connectedPlayers.black === null) {
        connectedPlayers.black = socket.id;
        myRole = "black";
        console.log(`先手(black)が決まりました: ${socket.id}`);
    } else if (connectedPlayers.white === null) {
        connectedPlayers.white = socket.id;
        myRole = "white";
        console.log(`後手(white)が決まりました: ${socket.id}`);
    } else {
        myRole = "spectator"; // 観戦者
        console.log(`観戦者(spectator)です: ${socket.id}`);
    }

    // ★★★ 変更：二人揃ったら、キャラ情報付きで対局開始合図を送る ★★★
    if (connectedPlayers.black && connectedPlayers.white) {
        console.log("二人揃いました。対局を開始します！");
        
        // 少し待ってから（キャラ情報の到着を待つため）開始合図を送る
        setTimeout(() => {
            io.emit('game start', {
                blackCharId: playerCharIds[connectedPlayers.black] || 'default',
                whiteCharId: playerCharIds[connectedPlayers.white] || 'default'
            });
        }, 500); 
    }

    // 2. 本人に役割を伝える
    socket.emit('role assigned', myRole);

    // 3. 指し手の転送処理
    socket.on('shogi move', (moveData) => {
        socket.broadcast.emit('shogi move', moveData);
    });

    // 必殺技の中継
    socket.on('skill activate', (data) => {
        console.log('必殺技発動を受信:', data);
        socket.broadcast.emit('skill activate', data);
    });

    // ゲームリセットの中継
    socket.on('game reset', () => {
        io.emit('game reset');
    });

    // 投了の中継
    socket.on('game resign', (data) => {
        socket.broadcast.emit('game resign', data);
    });

    // 4. 切断時の処理
    socket.on('disconnect', () => {
        console.log('切断されました: ' + socket.id);
        if (connectedPlayers.black === socket.id) {
            connectedPlayers.black = null;
        } else if (connectedPlayers.white === socket.id) {
            connectedPlayers.white = null;
        }
        // キャラ情報も削除
        delete playerCharIds[socket.id];
    });

});

server.listen(PORT, () => {
    console.log(`★サーバーが起動しました！: http://localhost:${PORT}`);
});

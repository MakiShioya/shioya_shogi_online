// server.js (キャラクター同期 + チャット履歴ファイル保存対応版)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs'); // ★追加1：ファイルを読み書きする機能「fs」を読み込む

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// クラウド環境のポート対応
const PORT = process.env.PORT || 3000;
const DATA_FILE = './chat_history.json'; // ★追加2：保存するファイルの名前

app.use(express.static('public'));

// 接続しているプレイヤーを管理する変数
let connectedPlayers = {
    black: null, // 先手のSocket ID
    white: null  // 後手のSocket ID
};

// 各プレイヤーが選んだキャラクターIDを保存する辞書
let playerCharIds = {}; 

// ★追加3：サーバー起動時に、保存ファイルがあれば読み込んで復元する
let chatHistory = [];
if (fs.existsSync(DATA_FILE)) {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        chatHistory = JSON.parse(data);
        console.log(`★過去のチャット履歴を ${chatHistory.length} 件読み込みました。`);
    } catch (e) {
        console.log("履歴ファイルの読み込みに失敗しました（初回はファイルがないため無視してOK）");
    }
}

io.on('connection', (socket) => {
    console.log('誰かが接続しました: ' + socket.id);

    // ★追加4：接続してきた人に、これまでの履歴を渡す
    socket.emit('chat history', chatHistory);

    // クライアントから「私はこのキャラです」と連絡が来たら保存する
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

    // 二人揃ったら、キャラ情報付きで対局開始合図を送る
    if (connectedPlayers.black && connectedPlayers.white) {
        console.log("二人揃いました。対局を開始します！");
        
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

    // ★★★ 変更：チャットの中継と「ファイル保存」 ★★★
    socket.on('chat message', (data) => {
        // 1. 履歴配列に追加
        chatHistory.push(data);
        
        // 2. 100件を超えたら古いのを消す（容量パンク防止）
        if (chatHistory.length > 100) {
            chatHistory.shift();
        }

        // 3. ファイルに書き込んで保存！
        fs.writeFileSync(DATA_FILE, JSON.stringify(chatHistory, null, 2));

        // 4. 全員に送信
        io.emit('chat message', data);
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

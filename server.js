// server.js (マッチング機能付き)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// 接続しているプレイヤーを管理する変数
let connectedPlayers = {
    black: null, // 先手のSocket ID
    white: null  // 後手のSocket ID
};

io.on('connection', (socket) => {
  console.log('誰かが接続しました: ' + socket.id);

  // ★ 1. 役割割り当て（早い者勝ち）
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
      myRole = "spectator"; // 観戦者（3人目以降）
      console.log(`観戦者(spectator)です: ${socket.id}`);
  }

  // ★★★ 追加：二人揃ったら対局開始の合図を送る ★★★
  if (connectedPlayers.black && connectedPlayers.white) {
      console.log("二人揃いました。対局を開始します！");
      io.emit('game start'); // 全員に「開始」合図を送る
  }

  // ★ 2. 本人に「あなたは〇〇役ですよ」と伝える
  socket.emit('role assigned', myRole);

  // ★ 3. 指し手の転送処理
  socket.on('shogi move', (moveData) => {
    // 受け取った手を、全員（自分含む）に送る、または相手だけに送る
    // 今回は「相手だけ」に送る broadcast を使います
    socket.broadcast.emit('shogi move', moveData);
  });


  // ★★★ 追加：必殺技の中継 ★★★
  socket.on('skill activate', (data) => {
  console.log('必殺技発動を受信:', data);
  socket.broadcast.emit('skill activate', data);
  });


  // ★★★ 追加：ゲームリセット（再戦）の中継 ★★★
  socket.on('game reset', () => {
    console.log('ゲームリセット命令を受信');
    // 全員（自分含む）に「リセットしろ！」と命令を送る
    io.emit('game reset');
  });

  // ★ 4. 切断時の処理（席を空ける）
  socket.on('disconnect', () => {
    console.log('切断されました: ' + socket.id);
    if (connectedPlayers.black === socket.id) {
        connectedPlayers.black = null;
    } else if (connectedPlayers.white === socket.id) {
        connectedPlayers.white = null;
    }
  });

  // ★★★ 追加：投了の中継 ★★★
  socket.on('game resign', (data) => {
      console.log('投了を受信:', data);
      socket.broadcast.emit('game resign', data);
  });

});

// ★変更点：クラウド環境(process.env.PORT)があればそれを使い、なければ3000を使う
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`★最新版サーバー(必殺技対応)が起動しました！: Port ${PORT}`);
});
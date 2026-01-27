// script/usi_engine.js
// 将棋エンジン（Web Worker）のモック
// 本来はここにWasmエンジンが入りますが、まずは通信テスト用に「適当な手を返す」機能だけ実装します。

self.onmessage = function(e) {
  const message = e.data;
  console.log("Engine received: " + message);

  // 1. "usi" と言われたら "usiok" と返す（挨拶）
  if (message === "usi") {
    self.postMessage("id name MockEngine 1.0");
    self.postMessage("usiok");
  }
  
  // 2. "isready" と言われたら "readyok" と返す（準備確認）
  else if (message === "isready") {
    self.postMessage("readyok");
  }
  
  // 3. "go"（考えろ）と言われたら、少し待ってから手を返す
  else if (message.startsWith("go")) {
    // 思考しているフリ（1秒待つ）
    setTimeout(() => {
      // 本来はここでWasmが計算して最強の手を弾き出します。
      // 今はテストなので、定跡通りの「7g7f（7六歩）」などを適当に返してみます。
      
      // ランダムに手を変えてみるテスト（本来はSFENを解析して合法手を返す）
      const moves = ["7g7f", "2g2f", "5g5f"];
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      
      self.postMessage("bestmove " + randomMove);
    }, 1000);
  }
};
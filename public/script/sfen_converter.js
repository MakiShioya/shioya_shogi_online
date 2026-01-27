// script/sfen_converter.js
// 盤面配列をSFEN文字列（将棋エンジンの共通言語）に変換するモジュール

function convertBoardToSFEN(board, hands, currentTurn, moveCount) {
  let sfen = "";

  // 1. 盤面の変換（9段目から1段目へ、ではなく1段目から9段目へ）
  // ※SFENは「左上（9一）」からスタートして行ごとに記述します
  for (let y = 0; y < 9; y++) {
    let emptyCount = 0;
    
    for (let x = 8; x >= 0; x--) { // 9筋(index 8)から1筋(index 0)へ
      const piece = board[y][x];

      if (piece === "") {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          sfen += emptyCount;
          emptyCount = 0;
        }
        // 駒の文字をSFEN形式に合わせる
        // 自分の駒(大文字)はそのままでOK、相手の駒(小文字)もそのままでOK
        // 成り駒 (+Pなど) もSFENでは +P と書くので基本はそのままで良いが、
        // エンジンによっては成駒の表記が異なる場合があるので整形する
        sfen += pieceToSfenObj(piece);
      }
    }
    
    if (emptyCount > 0) {
      sfen += emptyCount;
    }
    
    if (y < 8) {
      sfen += "/";
    }
  }

  sfen += " ";

  // 2. 手番の変換 (b:先手, w:後手)
  sfen += (currentTurn === "black" ? "b" : "w");
  sfen += " ";

  // 3. 持ち駒の変換
  // SFENでは「R2B」のように「種類+枚数」で書く（枚数が1なら省略）
  // 持ち駒がない場合は "-"
  const sfenHands = getSfenHands(hands);
  sfen += sfenHands;

  sfen += " ";

  // 4. 手数（通常は1からスタート）
  // ※エンジンによってはここを無視するものもあるが、念のため記述
  sfen += (moveCount || 1);

  return sfen;
}

// 駒文字の微調整
function pieceToSfenObj(piece) {
  // しおや将棋のデータ: "P" (先手歩), "p" (後手歩), "+P" (先手と), "+p" (後手と)
  // SFEN規格もほぼ同じだが、念の為確認
  return piece;
}

// 持ち駒文字列の生成
function getSfenHands(hands) {
  let result = "";
  
  // 先手（大文字）
  const blackCounts = countHandPieces(hands.black);
  // 順番: 飛 角 金 銀 桂 香 歩 の順が一般的（エンジンによるが）
  const order = ["R", "B", "G", "S", "N", "L", "P"];
  
  // 先手の持ち駒を追加
  order.forEach(p => {
    const count = blackCounts[p];
    if (count === 1) result += p;
    else if (count > 1) result += (count + p);
  });

  // 後手（小文字）
  const whiteCounts = countHandPieces(hands.white);
  const orderSmall = ["r", "b", "g", "s", "n", "l", "p"];
  
  orderSmall.forEach(p => {
    // 内部データでは持ち駒は大文字で保存されている場合があるので変換が必要
    // しおや将棋の hands.white には "P" や "p" どちらで入っていますか？
    // これまでのコードを見る限り、hands.white にも大文字 "P" などが入っているようです。
    // なので、カウント時は大文字で数えて、出力時に小文字にします。
    
    const upperKey = p.toUpperCase();
    const count = whiteCounts[upperKey];
    if (count === 1) result += p;
    else if (count > 1) result += (count + p);
  });

  return result === "" ? "-" : result;
}

// 配列内の駒をカウントするヘルパー
function countHandPieces(handArray) {
  const counts = { "R":0, "B":0, "G":0, "S":0, "N":0, "L":0, "P":0 };
  handArray.forEach(p => {
    // 成り駒が持ち駒に戻ることはないので、基本形のみ
    // 万が一 "+P" などが入っていても "P" としてカウントするなどの処理が必要ならここ
    const base = p.replace("+", "").toUpperCase();
    if (counts[base] !== undefined) {
      counts[base]++;
    }
  });
  return counts;
}
// kifu.js

function formatMove(sel, x, y, pieceBefore, boardBefore, moveNumber) {
  const files = ["９","８","７","６","５","４","３","２","１"];
  const ranks = ["一","二","三","四","五","六","七","八","九"];

  const toFile = files[x];
  const toRank = ranks[y];

  const isDrop = sel.fromHand;
  const fromX = sel.x;
  const fromY = sel.y;

  const isSameSquare = lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y;

  const base = pieceBefore.replace("+", "").toUpperCase();

  const pieceNames = {
    "P": "歩", "L": "香", "N": "桂", "S": "銀",
    "G": "金", "B": "角", "R": "飛", "K": "玉"
  };

  const mark = (moveNumber % 2 === 1) ? "▲" : "△";
  let move = `${moveNumber}手目：${mark}`;

  // 1. 移動先の表記 (７六 or 同)
  if (isSameSquare) {
    move += "同";
  } else {
    move += toFile + toRank;
  }

  // 2. 駒の名前
  move += pieceNames[base];

  // 3. 移動元 or 打の表記
  if (isDrop) {
    move += "打";
  } else {
    // 配列のインデックス(0~8)を将棋の座標(9~1)に変換
    const srcFileNum = 9 - fromX;
    const srcRankNum = fromY + 1;
    move += `(${srcFileNum}${srcRankNum})`;
  }

// 4. 成り・不成の表記
  const player = pieceBefore === pieceBefore.toLowerCase() ? "white" : "black";
  const wasPromoted = pieceBefore.includes("+");

  if (!wasPromoted && canPromote(base) &&
      (isInPromotionZone(fromY, player) || isInPromotionZone(y, player))) {
    if (sel.promoted) {
      move += "成";
    } else if (sel.unpromoted) {
      move += "不成";
    }
  }

  // ★5. 定跡の表記を追加
  if (isBookMove) {
      move += "(定跡)";
  }

  return move;
}

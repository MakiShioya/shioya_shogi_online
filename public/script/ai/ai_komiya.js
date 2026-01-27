// ai.js

// 駒の価値定義
const pieceValues = {
  "P": 50, "L": 200, "N": 250, "S": 300,
  "G": 350, "B": 600, "R": 650, "K": 99999, 
  "+P": 350, "+L": 300, "+N": 300, "+S": 350,
  "+B": 650, "+R": 750
};

// 位置評価テーブル
const positionBonus = {
  // 玉：端（特に下段）にいるほど安全（囲いボーナス）
  "K": [
    [-50, -50, -50, -50, -50, -50, -50, -50, -50], // 敵陣深くは危険
    [-50, -50, -50, -50, -50, -50, -50, -50, -50],
    [-50, -50, -50, -50, -50, -50, -50, -50, -50],
    [-20, -20, -20, -20, -20, -20, -20, -20, -20],
    [-10, -10, -10, -10, -10, -10, -10, -10, -10],
    [  0,   0,   0,   0,   0,   0,   0,   0,   0],
    [ 10,  10,  10,  10,  10,  10,  10,  10,  10],
    [ 20,  60,  30,  10,  10,  10,  30,  40,  20],
    [ 50,  50,  40,  30,  20,  30,  60,  60,  50]  // 自陣奥底が良い
  ],
  // 金・銀：王を守るため下段中央付近が良い
  "G": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0, 10,  0,  0,  0,  0,  0],
    [ 0,  0, 20,  0,  5,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0]
  ],
  "S": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,500,  0,  0, 20,  0,  0,  0],
    [ 0, 25, 20, 25,  5, 10,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0]
  ],
  "L": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [10,  0,  0,  0,  0,  0,  0,  0, 10]
  ],
  "P": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0, 30,  0],
    [ 1,  0,  1,  1,  0,  1,  5, 20,  1],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0]
  ],
  "B": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,-50,  0,  0,  0,  0],
    [ 0,  0,  0,-50,  0, 50,  0,  0,  0],
    [ 0,  0,  0,  0, 40,  0,  0,  0,  0],
    [ 0,  0,  0, 40,  0,  0,  0,  0,  0],
    [ 0,  0, 30,  0,  0,  0,  0,  0,  0]
  ]
  // ※他の駒も好みで定義可能ですが、まずは玉と金だけで十分効果があります
};


function makeSilentMove(move) {
  const player = turn;
  const pieceBefore = move.fromHand 
    ? hands[player][move.index] 
    : boardState[move.y0][move.x0];

  const record = {
    fromHand: move.fromHand,
    fromX: move.x0,
    fromY: move.y0,
    toX: move.x1,
    toY: move.y1,
    pieceMoved: pieceBefore,
    capturedPiece: boardState[move.y1][move.x1],
    index: move.index,
    wasPromoted: false
  };

  if (move.fromHand) {
    const piece = hands[player].splice(move.index, 1)[0];
    boardState[move.y1][move.x1] = (player === "white") ? piece.toLowerCase() : piece;
  } else {
    let piece = boardState[move.y0][move.x0];
    if (record.capturedPiece) {
      const cap = record.capturedPiece.replace("+","").toUpperCase();
      hands[player].push(cap);
    }
    const base = piece.replace("+","").toUpperCase();
    if (!piece.includes("+") && ["P","L","N","S","B","R"].includes(base)) {
      if (isInPromotionZone(move.y1, player) || isInPromotionZone(move.y0, player)) {
        piece = (player === "white") ? ("+" + base).toLowerCase() : ("+" + base);
        record.wasPromoted = true;
      }
    }
    boardState[move.y0][move.x0] = "";
    boardState[move.y1][move.x1] = piece;
  }
  turn = (turn === "black" ? "white" : "black");
  return record;
}

function unmakeSilentMove(record) {
  turn = (turn === "black" ? "white" : "black");
  const player = turn;
  if (record.fromHand) {
    boardState[record.toY][record.toX] = "";
    hands[player].splice(record.index, 0, record.pieceMoved);
  } else {
    boardState[record.fromY][record.fromX] = record.pieceMoved;
    boardState[record.toY][record.toX] = record.capturedPiece;
    if (record.capturedPiece) {
      hands[player].pop();
    }
  }
}

function isSafeAfterCapture(move, player) {
  const snapshot = deepCopyState();
  makeSilentMove(move);
  const opponent = player === "black" ? "white" : "black";
  const opponentMoves = getAllLegalMoves(opponent);
  const capturedSquare = { x: move.x1, y: move.y1 };
  const isRecaptured = opponentMoves.some(m =>
    !m.fromHand &&
    m.x1 === capturedSquare.x &&
    m.y1 === capturedSquare.y
  );
  restoreState(snapshot);
  return !isRecaptured;
}

function cpuMove() {
  if (gameOver) return;

  // ★ ③ 20手目以内 & 直前が「２五歩」なら ３二金 or ３三角
  if (
    moveCount < 20 &&
    lastPlayerMove &&
    lastPlayerMove.piece === "P" &&
    lastPlayerMove.toX === 7 && // ２筋
    lastPlayerMove.toY === 4    // ５段目
  ) {

    // ① まず３二金を探す
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const p = boardState[y][x];
        if (cpuSide === "white" && p === "g") {
          const moves = getLegalMoves(x, y);
          if (moves.some(m => m.x === 6 && m.y === 1)) {
            selected = { x, y, fromHand: false };
            movePieceWithSelected(selected, 6, 1);
            selected = null;
            legalMoves = [];
            render();
            return;
          }
        }
      }
    }
    // ② ３二金が無理なら３三角
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const p = boardState[y][x];
        if (cpuSide === "white" && p === "b") {
          const moves = getLegalMoves(x, y);
          if (moves.some(m => m.x === 6 && m.y === 2)) {
            selected = { x, y, fromHand: false };
            movePieceWithSelected(selected, 6, 2);
            selected = null;
            legalMoves = [];
            render();
            return;
          }
        }
      }
    }
  }

  // 5手目：▲２四歩(25) に対して△同歩(23)
  if (moveCount === 5 && cpuSide === "white") {
    if (lastPlayerMove && lastPlayerMove.piece === "P" && 
        lastPlayerMove.toX === 7 && lastPlayerMove.toY === 3) {
      
      const fromX = 7; const fromY = 2; // 2三の歩
      const toX = 7; const toY = 3;     // 2四へ移動
      
      // 念のため、そこに自分の歩があるか確認してから指す
      if (boardState[fromY][fromX] === "p") {
        selected = { x: fromX, y: fromY, fromHand: false };
        movePieceWithSelected(selected, toX, toY);
        selected = null;
        legalMoves = [];
        render();
        return;
      }
    }
  }

  // 25手目以内：▲２四飛(25) に対して△２三歩打(23)
  if (moveCount < 25 && cpuSide === "white") {
    // 直前の手が飛車(R)で、移動先が2四(7,3)かチェック
    // ※lastPlayerMove.pieceは"+"が除外された状態で記録されているため "R" で判定
    if (lastPlayerMove && lastPlayerMove.piece === "R" && 
        lastPlayerMove.toX === 7 && lastPlayerMove.toY === 3) {
      
      const dropX = 7; const dropY = 2; // 2三
      const pawnIndex = hands.white.indexOf("P"); // 持ち駒の歩を探す

      // 2三が空いていて、持ち駒に歩があるなら打つ
      if (boardState[dropY][dropX] === "" && pawnIndex !== -1) {
        selected = { fromHand: true, player: "white", index: pawnIndex };
        movePieceWithSelected(selected, dropX, dropY);
        selected = null;
        legalMoves = [];
        render();
        return;
      }
    }
  }

  if (moveCount === 1 && cpuSide === "white") {
    const fromX = 6; const fromY = 2;
    const toX = 6; const toY = 3;
    selected = { x: fromX, y: fromY, fromHand: false };
    movePieceWithSelected(selected, toX, toY);
    selected = null;
    legalMoves = [];
    render();
    return;
  }

  // 3手目：▲２二角成/不成(7,1) に対して △同銀(31->71)
  if (moveCount === 3 && cpuSide === "white") {
    // 直前の手が角(B)で、移動先が2二(7,1)かチェック
    if (lastPlayerMove && lastPlayerMove.piece === "B" && 
        lastPlayerMove.toX === 7 && lastPlayerMove.toY === 1) {
      
      const fromX = 6; const fromY = 0; // 3一の銀
      const toX = 7; const toY = 1;     // 2二へ移動
      
      // 3一に自分の銀があるか確認
      if (boardState[fromY][fromX] === "s") {
        selected = { x: fromX, y: fromY, fromHand: false };
        movePieceWithSelected(selected, toX, toY);
        selected = null;
        legalMoves = [];
        render();
        return;
      }
    }
  }

  if (moveCount >= 3 && moveCount <= 4 && cpuSide === "white") {
    const fromX = 5; const fromY = 2;
    const toX = 5; const toY = 3;
    if (boardState[fromY][fromX] === "p" && boardState[toY][toX] === "") {
      selected = { x: fromX, y: fromY, fromHand: false };
      movePieceWithSelected(selected, toX, toY);
      selected = null;
      legalMoves = [];
      render();
      return;
    }
  }

  const captureMoves = getAllLegalMoves(cpuSide).filter(m => {
    if (m.fromHand) return false;
    const target = boardState[m.y1][m.x1];
    if (!target) return false;
    const mover = boardState[m.y0][m.x0];
    const targetKey = target.startsWith("+") ? "+" + target.replace("+", "").toUpperCase() : target.toUpperCase();
    const moverKey = mover.startsWith("+") ? "+" + mover.replace("+", "").toUpperCase() : mover.toUpperCase();
    const targetValue = pieceValues[targetKey] || 0;
    const moverValue = pieceValues[moverKey] || 0;
    if (targetValue >= moverValue) return true;
    return isSafeAfterCapture(m, cpuSide);
  });

  if (captureMoves.length > 0) {
    let bestCapture = null;
    let bestValue = -Infinity;
    for (const move of captureMoves) {
      const target = boardState[move.y1][move.x1];
      const key = target.startsWith("+") ? "+" + target.replace("+", "").toUpperCase() : target.toUpperCase();
      const value = pieceValues[key] || 0;
      if (value > bestValue) {
        bestValue = value;
        bestCapture = move;
      }
    }
    if (bestCapture) {
      if (bestCapture.fromHand) {
        selected = { fromHand: true, player: cpuSide, index: bestCapture.index };
        movePieceWithSelected(selected, bestCapture.x1, bestCapture.y1);
      } else {
        selected = { x: bestCapture.x0, y: bestCapture.y0, fromHand: false };
        movePieceWithSelected(selected, bestCapture.x1, bestCapture.y1);
      }
      selected = null;
      legalMoves = [];
      render();
      return;
    }
  }

  const bestMove = findBestMove(6);
  if (!bestMove) return;

  if (bestMove.fromHand) {
    selected = { fromHand: true, player: cpuSide, index: bestMove.index };
    movePieceWithSelected(selected, bestMove.x1, bestMove.y1);
  } else {
    selected = { x: bestMove.x0, y: bestMove.y0, fromHand: false };
    movePieceWithSelected(selected, bestMove.x1, bestMove.y1);
  }
  selected = null;
  legalMoves = [];
  render();
}

function evaluateBoard(player) {
  let score = 0;
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const p = boardState[y][x];
      if (!p) continue;
      const isWhite = p === p.toLowerCase();
      const owner = isWhite ? "white" : "black";
      const baseKey = p.replace("+", "").toUpperCase();
      const key = p.startsWith("+") ? "+" + baseKey : baseKey;
      
      let materialValue = pieceValues[key] || 0;
      let positionalValue = 0;

      // 【修正箇所】
      // 1. 位置ボーナス定義が存在すること
      // 2. 「25手未満」または「駒が玉(K)か金(G)」であること
      // この両方を満たす場合のみ位置評価を加算します
      if (positionBonus[baseKey] && (moveCount < 25 || baseKey === "K" || baseKey === "G")) {
        const tableY = isWhite ? (8 - y) : y;
        const tableX = isWhite ? (8 - x) : x;
        positionalValue = positionBonus[baseKey][tableY][tableX];
      }

      const totalValue = materialValue + positionalValue;
      if (owner === player) {
        score += totalValue;
      } else {
        score -= totalValue;
      }
    }
  }
  hands[player].forEach(p => score += (pieceValues[p] || 0) * 1.1);
  const opponent = player === "black" ? "white" : "black";
  hands[opponent].forEach(p => score -= (pieceValues[p] || 0) * 1.1);
  return score;
}

function getAllLegalMoves(player) {
  const allMoves = [];
  const openingPhase = moveCount < 6;
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const p = boardState[y][x];
      if (!p) continue;
      const isWhite = p === p.toLowerCase();
      if ((player === "black" && !isWhite) || (player === "white" && isWhite)) {
        const base = p.replace("+", "").toUpperCase();
        if (openingPhase && base === "L") continue;
        const moves = getLegalMoves(x, y);
        moves.forEach(m => {
          allMoves.push({ fromHand: false, x0: x, y0: y, x1: m.x, y1: m.y });
        });
      }
    }
  }
  const hand = hands[player];
  for (let i = 0; i < hand.length; i++) {
    const piece = hand[i];
    if (openingPhase && piece === "L") continue;
    const drops = getLegalDrops(player, piece);
    drops.forEach(m => {
      allMoves.push({ fromHand: true, player, index: i, x1: m.x, y1: m.y });
    });
  }
  return allMoves;
}

function sortMoves(moves) {
  return moves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    if (!a.fromHand) {
      const targetA = boardState[a.y1][a.x1];
      if (targetA) {
        const keyA = targetA.replace("+","").toUpperCase();
        scoreA = pieceValues[keyA] || 0;
      }
    }
    if (!b.fromHand) {
      const targetB = boardState[b.y1][b.x1];
      if (targetB) {
        const keyB = targetB.replace("+","").toUpperCase();
        scoreB = pieceValues[keyB] || 0;
      }
    }
    return scoreB - scoreA;
  });
}

let searchStartTime = 0;
let currentTimeLimit = 10000;

function findBestMove(maxDepth = 6) {
  isSimulating = true;
  const player = cpuSide;
  const allMoves = getAllLegalMoves(player);
  
  if (allMoves.length === 0) {
    isSimulating = false;
    return null;
  }
  if (allMoves.length === 1) {
    isSimulating = false;
    return allMoves[0];
  }

// --- 【ここに追加】 手数に応じた思考時間の設定 ---
  if (moveCount < 24) {
    currentTimeLimit = 2000;      // 24手目未満: 2秒
  } else if (moveCount < 30) {
    currentTimeLimit = 4000;      // 30手目未満: 4秒
  } else if (moveCount < 36) {
    currentTimeLimit = 6000;      // 36手目未満: 6秒
  } else if (moveCount < 42) {
    currentTimeLimit = 8000;      // 42手目未満: 8秒
  } else {
    currentTimeLimit = 10000;     // それ以降: 10秒
  }
  // ---------------------------------------------
  
  sortMoves(allMoves);
  let bestMove = allMoves[0]; 
  searchStartTime = Date.now();

  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      let currentBestMove = null;
      let bestScore = -Infinity;

      for (const move of allMoves) {
        const record = makeSilentMove(move);
        let score;
        try {
          score = minimax(depth - 1, false, -Infinity, Infinity);
        } finally {
          unmakeSilentMove(record);
        }
        if (score > bestScore) {
          bestScore = score;
          currentBestMove = move;
        }
      }

      if (currentBestMove) {
        bestMove = currentBestMove;
        if (bestScore >= 90000) break; 
      }
      
      const bestIdx = allMoves.indexOf(bestMove);
      if (bestIdx > -1) {
        allMoves.splice(bestIdx, 1);
        allMoves.unshift(bestMove);
      }
    }
  } catch (e) {
    if (e === "TIMEOUT") {
      console.log("思考時間が制限を超えたため、中断時点の最善手を指します。");
    } else {
      console.error(e);
    }
  }

  isSimulating = false;
  return bestMove;
}

function minimax(depth, isMaximizing, alpha, beta) {
  if ((Date.now() - searchStartTime) > currentTimeLimit) {
    throw "TIMEOUT";
  }

  if (depth === 0 || gameOver) {
    return evaluateBoard(cpuSide);
  }

  const currentPlayer = isMaximizing ? cpuSide : (cpuSide === "black" ? "white" : "black");
  const moves = getAllLegalMoves(currentPlayer);

  if (moves.length === 0) {
    return isKingInCheck(currentPlayer) ? (isMaximizing ? -100000 : 100000) : 0;
  }
  
  if (depth > 1) sortMoves(moves);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const record = makeSilentMove(move);
      try {
        const eval = minimax(depth - 1, false, alpha, beta);
        maxEval = Math.max(maxEval, eval);
        alpha = Math.max(alpha, maxEval);
      } finally {
        unmakeSilentMove(record);
      }
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const record = makeSilentMove(move);
      try {
        const eval = minimax(depth - 1, true, alpha, beta);
        minEval = Math.min(minEval, eval);
        beta = Math.min(beta, minEval);
      } finally {
        unmakeSilentMove(record);
      }
      if (beta <= alpha) break;
    }
    return minEval;
  }
}
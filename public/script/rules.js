// rules.js



/* -------------------------

   状態管理 (State Management)

   AIとMainの両方で使用するため、ここに配置します

   ------------------------- */



function deepCopyState() {

  return {

    board: boardState.map(r => r.slice()),
// ★追加：スタイル配列のコピー
    pieceStyles: JSON.parse(JSON.stringify(pieceStyles)),

    hands: {

      black: hands.black.slice(),

      white: hands.white.slice()

    },

    turn: turn,

    moveCount: moveCount,

    kifu: kifu.slice(),

    positionHistory: JSON.parse(JSON.stringify(positionHistory)),

    repetitionHistory: JSON.parse(JSON.stringify(repetitionHistory)),

    lastMoveTo: lastMoveTo ? { ...lastMoveTo } : null

  };

}



function restoreState(state) {

  boardState = state.board.map(r => r.slice());
// ★追加：スタイル配列の復元
  pieceStyles = JSON.parse(JSON.stringify(state.pieceStyles));

  hands.black = state.hands.black.slice();

  hands.white = state.hands.white.slice();

  turn = state.turn;

  moveCount = state.moveCount;

  kifu = state.kifu.slice();

  positionHistory = JSON.parse(JSON.stringify(state.positionHistory));

  repetitionHistory = JSON.parse(JSON.stringify(state.repetitionHistory));

  lastMoveTo = state.lastMoveTo ? { ...state.lastMoveTo } : null;

  

  // UI関連の選択状態もリセット

  selected = null;

  legalMoves = [];

}



/* -------------------------

   ルール・判定ロジック

   ------------------------- */



/* 成り判定 */

function isInPromotionZone(y, player) { return player === "black" ? y <= 2 : y >= 6; }

function canPromote(piece) { return ["P","L","N","S","B","R"].includes(piece); }

function promote(piece) { return piece.startsWith("+") ? piece : "+" + piece; }



/* 王手判定 */

function findKing(player) {

  const k = player === "black" ? "K" : "k";

  for (let y = 0; y < 9; y++)

    for (let x = 0; x < 9; x++)

      if (boardState[y][x] === k) return {x, y};

  return null;

}



function isKingInCheck(player) {

  const king = findKing(player);

  if (!king) return false;

  const opponent = player === "black" ? "white" : "black";



  for (let y = 0; y < 9; y++) {

    for (let x = 0; x < 9; x++) {

      const p = boardState[y][x];

      if (!p) continue;

      const isWhite = p === p.toLowerCase();

      if ((opponent === "white" && isWhite) || (opponent === "black" && !isWhite)) {

        const moves = getRawLegalMoves(x, y);

        if (moves.some(m => m.x === king.x && m.y === king.y)) return true;

      }

    }

  }

  return false;

}



/* 駒の動き (Raw) */

function getRawLegalMoves(x, y) {

  const piece = boardState[y][x];

  const isWhite = piece === piece.toLowerCase();

  const player = isWhite ? "white" : "black";

  const dir = player === "black" ? -1 : 1;

  const base = piece.replace("+","").toUpperCase();

  const promoted = piece.startsWith("+");

  const moves = [];



  function add(nx, ny) {

    if (nx < 0 || nx > 8 || ny < 0 || ny > 8) return false;

    const target = boardState[ny][nx];

    if (target && (target === target.toLowerCase()) === isWhite) return false;

    moves.push({ x: nx, y: ny });

    return !target;

  }

  function slide(dx, dy) {

    let nx = x + dx, ny = y + dy;

    while (add(nx, ny)) {

      nx += dx;

      ny += dy;

    }

  }



  if (!promoted) {

    switch (base) {

      case "P": add(x, y + dir); break;

      case "L": slide(0, dir); break;

      case "N": add(x - 1, y + 2 * dir); add(x + 1, y + 2 * dir); break;

      case "S":

        add(x - 1, y + dir); add(x, y + dir); add(x + 1, y + dir);

        add(x - 1, y - dir); add(x + 1, y - dir); break;

      case "G":

        add(x - 1, y + dir); add(x, y + dir); add(x + 1, y + dir);

        add(x - 1, y); add(x + 1, y); add(x, y - dir); break;

      case "K":

        for (let dx = -1; dx <= 1; dx++)

          for (let dy = -1; dy <= 1; dy++)

            if (dx || dy) add(x + dx, y + dy);

        break;

      case "B": slide(1,1); slide(-1,1); slide(1,-1); slide(-1,-1); break;

      case "R": slide(1,0); slide(-1,0); slide(0,1); slide(0,-1); break;

    }

  } else {

    if (base === "B") {

      slide(1,1); slide(-1,1); slide(1,-1); slide(-1,-1);

      add(x-1,y); add(x+1,y); add(x,y-1); add(x,y+1);

    } else if (base === "R") {

      slide(1,0); slide(-1,0); slide(0,1); slide(0,-1);

      add(x-1,y-1); add(x+1,y-1); add(x-1,y+1); add(x+1,y+1);

    } else {

      add(x - 1, y + dir); add(x, y + dir); add(x + 1, y + dir);

      add(x - 1, y); add(x + 1, y); add(x, y - dir);

    }

  }

  return moves;

}



/* 合法手（自玉王手禁止を含む） */

function getLegalMoves(x, y) {

  const raw = getRawLegalMoves(x, y);

  const piece = boardState[y][x];

  const isWhite = piece === piece.toLowerCase();

  const player = isWhite ? "white" : "black";



  return raw.filter(m => {

    const fromPiece = boardState[y][x];

    const toPiece = boardState[m.y][m.x];



    // 盤面を一時的に変更

    boardState[m.y][m.x] = fromPiece;

    boardState[y][x] = "";



    const inCheck = isKingInCheck(player);



    // 元に戻す

    boardState[y][x] = fromPiece;

    boardState[m.y][m.x] = toPiece;



    return !inCheck;

  });

}



/* 持ち駒打ちチェック */

function getLegalDrops(player, piece, ignorePawnMate = false) {

  const moves = [];

  const isBlack = (player === "black");



  const nifuColumns = new Array(9).fill(false);

  if (piece === "P") {

    for (let x = 0; x < 9; x++) {

      for (let y = 0; y < 9; y++) {

        const p = boardState[y][x];

        if ((isBlack && p === "P") || (!isBlack && p === "p")) {

          nifuColumns[x] = true;

          break;

        }

      }

    }

  }



  for (let y = 0; y < 9; y++) {

    for (let x = 0; x < 9; x++) {

      if (boardState[y][x] !== "") continue;

      if ((piece === "P" || piece === "L") && y === (isBlack ? 0 : 8)) continue;

      if (piece === "N" && (isBlack ? y <= 1 : y >= 7)) continue;

      if (piece === "P" && nifuColumns[x]) continue;

      if (piece === "P" && !ignorePawnMate) {

        if (isPawnDropMate(x, y, player)) continue;

      }

      const placed = isBlack ? piece : piece.toLowerCase();

      boardState[y][x] = placed;

      const inCheck = isKingInCheck(player);

      boardState[y][x] = "";

      if (inCheck) continue;

      moves.push({ x, y });

    }

  }

  return moves;

}



function hasAnyLegalMove(player, isCheckingPawnMate = false) {

  // 盤上の駒

  for (let y = 0; y < 9; y++) {

    for (let x = 0; x < 9; x++) {

      const p = boardState[y][x];

      if (!p) continue;

      const isWhite = p === p.toLowerCase();

      if ((player === "black" && !isWhite) || (player === "white" && isWhite)) {

        if (getLegalMoves(x, y).length > 0) return true;

      }

    }

  }

  // 持ち駒 (重複チェックを最適化しつつループ)

  const hand = hands[player];

  const uniqueHand = Array.from(new Set(hand));

  for (const p of uniqueHand) {

    if (getLegalDrops(player, p, isCheckingPawnMate).length > 0) return true;

  }

  return false;

}



function isPawnDropMate(x, y, player) {

  const piece = player === "black" ? "P" : "p";

  boardState[y][x] = piece;

  const opponent = player === "black" ? "white" : "black";

  

  const inCheck = isKingInCheck(opponent);

  if (!inCheck) {

    boardState[y][x] = "";

    return false;

  }

  // trueを渡して、相手の打ち歩詰め判定での無限再帰を防ぐ

  const hasMove = hasAnyLegalMove(opponent, true);

  boardState[y][x] = "";

  return !hasMove;

}



/* 局面ハッシュキー取得 (千日手判定用 - これが抜けていました) */

function getPositionKey() {

  const boardKey = boardState.map(r => r.join("")).join("/");

  const blackHand = hands.black.slice().sort().join("");

  const whiteHand = hands.white.slice().sort().join("");

  return boardKey + "|" + blackHand + "|" + whiteHand + "|" + turn;

}



/* 千日手履歴記録 (これも抜けていました) */

function recordRepetition() {

  const key = getPositionKey();

  if (!repetitionHistory[key]) {

    repetitionHistory[key] = [];

  }



  // 今の局面で王手をかけている側を記録

  const isCheck = isKingInCheck(turn);

  const checkingSide = isCheck ? (turn === "black" ? "white" : "black") : null;



  repetitionHistory[key].push({

    isCheck,

    checkingSide

  });

}



/* 仮想盤面チェック用 (Kifu/AIで使用) */

function getLegalMovesFromBoard(x, y, board) {

  const piece = board[y][x];

  const isWhite = piece === piece.toLowerCase();

  const player = isWhite ? "white" : "black";

  const raw = getRawLegalMovesFromBoard(x, y, board);

  return raw.filter(m => {

    const fromPiece = board[y][x];

    const toPiece = board[m.y][m.x];

    board[m.y][m.x] = fromPiece;

    board[y][x] = "";

    const inCheck = isKingInCheckFromBoard(player, board);

    board[y][x] = fromPiece;

    board[m.y][m.x] = toPiece;

    return !inCheck;

  });

}



function getRawLegalMovesFromBoard(x, y, board) {

  const piece = board[y][x];

  const isWhite = piece === piece.toLowerCase();

  const player = isWhite ? "white" : "black";

  const dir = player === "black" ? -1 : 1;

  const base = piece.replace("+","").toUpperCase();

  const promoted = piece.startsWith("+");

  const moves = [];



  function add(nx, ny) {

    if (nx < 0 || nx > 8 || ny < 0 || ny > 8) return false;

    const target = board[ny][nx];

    if (target && (target === target.toLowerCase()) === isWhite) return false;

    moves.push({ x: nx, y: ny });

    return !target;

  }

  function slide(dx, dy) {

    let nx = x + dx, ny = y + dy;

    while (add(nx, ny)) {

      nx += dx;

      ny += dy;

    }

  }



  if (!promoted) {

    switch (base) {

      case "P": add(x, y + dir); break;

      case "L": slide(0, dir); break;

      case "N": add(x - 1, y + 2 * dir); add(x + 1, y + 2 * dir); break;

      case "S":

        add(x - 1, y + dir); add(x, y + dir); add(x + 1, y + dir);

        add(x - 1, y - dir); add(x + 1, y - dir); break;

      case "G":

        add(x - 1, y + dir); add(x, y + dir); add(x + 1, y + dir);

        add(x - 1, y); add(x + 1, y); add(x, y - dir); break;

      case "K":

        for (let dx = -1; dx <= 1; dx++)

          for (let dy = -1; dy <= 1; dy++)

            if (dx || dy) add(x + dx, y + dy);

        break;

      case "B": slide(1,1); slide(-1,1); slide(1,-1); slide(-1,-1); break;

      case "R": slide(1,0); slide(-1,0); slide(0,1); slide(0,-1); break;

    }

  } else {

    if (base === "B") {

      slide(1,1); slide(-1,1); slide(1,-1); slide(-1,-1);

      add(x-1,y); add(x+1,y); add(x,y-1); add(x,y+1);

    } else if (base === "R") {

      slide(1,0); slide(-1,0); slide(0,1); slide(0,-1);

      add(x-1,y-1); add(x+1,y-1); add(x-1,y+1); add(x+1,y+1);

    } else {

      add(x - 1, y + dir); add(x, y + dir); add(x + 1, y + dir);

      add(x - 1, y); add(x + 1, y); add(x, y - dir);

    }

  }

  return moves;

}



function isKingInCheckFromBoard(player, board) {

  const k = player === "black" ? "K" : "k";

  let king = null;

  for (let y = 0; y < 9; y++)

    for (let x = 0; x < 9; x++)

      if (board[y][x] === k) king = {x, y};



  if (!king) return false;

  const opponent = player === "black" ? "white" : "black";



  for (let y = 0; y < 9; y++) {

    for (let x = 0; x < 9; x++) {

      const p = board[y][x];

      if (!p) continue;

      const isWhite = p === p.toLowerCase();

      if ((opponent === "white" && isWhite) || (opponent === "black" && !isWhite)) {

        const moves = getRawLegalMovesFromBoard(x, y, board);

        if (moves.some(m => m.x === king.x && m.y === king.y)) return true;

      }

    }

  }

  return false;

}
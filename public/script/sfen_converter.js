// ==========================================
// sfen_converter.js - 安定版
// ==========================================

function convertBoardToSFEN(board, hands, currentTurn, moveCount) {
    let sfen = "";

    // 内部的な駒名マップ（漢字が混入しても大丈夫なように）
    const pieceToSfen = {
        "歩": "P", "香": "L", "桂": "N", "銀": "S", "金": "G", "角": "B", "飛": "R", "玉": "K", "王": "K",
        "+歩": "+P", "+香": "+L", "+桂": "+N", "+銀": "+S", "+角": "+B", "+飛": "+R"
    };

    // 1. 盤面の変換（Rank 1[y=0]からRank 9[y=8]へ）
    for (let y = 0; y < 9; y++) {
        let emptyCount = 0;
        for (let x = 0; x < 9; x++) { 
            let piece = board[y][x];
            if (piece === "") {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    sfen += emptyCount;
                    emptyCount = 0;
                }
                // 漢字なら変換、英字ならそのまま使用
                let sfenChar = pieceToSfen[piece] || piece;
                sfen += sfenChar;
            }
        }
        if (emptyCount > 0) sfen += emptyCount;
        if (y < 8) sfen += "/";
    }

    // 2. 手番 (b = 先手 / w = 後手)
    sfen += (currentTurn === "black" ? " b " : " w ");

    // 3. 持ち駒の変換
    sfen += getSfenHands(hands);

    // 4. 手数（次に指す手の番号。開始局面なら1）
    sfen += " " + (parseInt(moveCount) + 1);

    return sfen;
}

function getSfenHands(hands) {
    let result = "";
    // USI規格の標準的な順序
    const order = ["K", "R", "B", "G", "S", "N", "L", "P"];
    
    // 先手（大文字）
    order.forEach(p => {
        const count = hands.black.filter(h => h.toUpperCase() === p).length;
        if (count === 1) result += p;
        else if (count > 1) result += count + p;
    });

    // 後手（小文字）
    order.forEach(p => {
        const count = hands.white.filter(h => h.toUpperCase() === p).length;
        if (count === 1) result += p.toLowerCase();
        else if (count > 1) result += count + p.toLowerCase();
    });

    return result === "" ? "-" : result;
}

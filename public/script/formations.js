// 戦法の定義リスト
const FORMATION_DATA = [
    {
        id: "MINO",
        name: "美濃囲い",
        image: "script/image/cutin/mino.png",
        audio: "script/audio/se/mino.mp3",
        // 先手(Black)視点の座標 {row, col, piece} 
        // 1一を(0,0)とするか、9九を(8,8)とするかは既存のboard配列に合わせてください
        requirements: [
            { r: 8, c: 7, p: "S" }, // 8七銀
            { r: 8, c: 8, p: "G" }, // 8八金
            { r: 7, c: 8, p: "G" }, // 7八金
            { r: 8, c: 9, p: "K" }  // 9九玉
        ]
    },
    {
        id: "SHIKEN",
        name: "四間飛車",
        image: "script/image/cutin/shiken.png",
        audio: "script/audio/se/shiken.mp3",
        requirements: [
            { r: 6, c: 7, p: "R" }  // 7八飛
        ]
    }
    // ここにどんどん追加できます
];

// すでに発動した戦法を記録（1対局1回まで）
let triggeredFormations = new Set();

/**
 * 座標を後手用に反転させる関数
 * row: 0~8, col: 0~8 を想定
 */
function getRelativePos(pos, isWhite) {
    if (!isWhite) return pos; 
    return {
        r: 8 - pos.r, // 行を反転
        c: 8 - pos.c, // 列を反転
        p: pos.p      // 駒種はそのまま
    };
}

/**
 * 戦法が成立しているかチェックする
 */
function checkFormations(board, isWhite) {
    for (const f of FORMATION_DATA) {
        if (triggeredFormations.has(f.id)) continue;

        const isComplete = f.requirements.every(req => {
            const rel = getRelativePos(req, isWhite);
            const pieceOnBoard = board[rel.r][rel.c];
            
            // 自分の駒種と一致するか（先手なら大文字、後手なら小文字など）
            const targetPiece = isWhite ? req.p.toLowerCase() : req.p.toUpperCase();
            return pieceOnBoard === targetPiece;
        });

        if (isComplete) {
            executeFormationEffect(f);
            triggeredFormations.add(f.id);
        }
    }
}

/**
 * 演出の実行
 */
function executeFormationEffect(formation) {
    // 画像の表示
    const cutIn = document.getElementById('skillCutIn');
    cutIn.src = formation.image;
    cutIn.classList.add('cut-in-active');

    // 音声の再生
    const se = new Audio(formation.audio);
    se.volume = 0.5;
    se.play();

    // 演出終了後にクラスを外す
    setTimeout(() => {
        cutIn.classList.remove('cut-in-active');
    }, 2000); // animationの長さに合わせる
}

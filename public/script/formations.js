// script/formations.js

// 座標指定を直感的にするためのヘルパー関数
// 例: pos(7, 8) => 7八 の配列インデックス {y:7, x:2} を返す
function pos(suji, dan) {
    return { y: dan - 1, x: 9 - suji };
}

// 戦法の定義リスト
const FORMATION_DATA = [
    {
        id: "MINO",
        name: "美濃囲い",
        image: "script/senpou/mino.png", // パスを確認してください
        audio: "script/senpou/mino.mp3", // パスを確認してください
        // 先手番基準の配置
        requirements: [
            { suji: 2, dan: 8, p: "K" }, // 2八玉
            { suji: 3, dan: 8, p: "S" }, // 3八銀
            { suji: 4, dan: 9, p: "G" }, // 4九金
            { suji: 5, dan: 8, p: "G" }  // 5八金
        ]
    },
    {
        id: "SHIKEN",
        name: "四間飛車",
        image: "script/senpou/shiken.png",
        audio: "script/senpou/shiken.mp3",
        requirements: [
            { suji: 6, dan: 8, p: "R" }  // 6八飛（先手の四間飛車は6筋です！）
        ]
    },
    {
        id: "SANKEN",
        name: "三間飛車",
        image: "script/senpou/sanken.png",
        audio: "script/senpou/sanken.mp3",
        requirements: [
            { suji: 7, dan: 8, p: "R" }  // 7八飛
        ]
    },
    {
        id: "NAKA",
        name: "中飛車",
        image: "script/senpou/naka.png",
        audio: "script/senpou/naka.mp3",
        requirements: [
            { suji: 5, dan: 8, p: "R" }  // 5八飛
        ]
    }
];

// すでに発動した戦法を記録（プレイヤーIDごとに管理すると安全ですが、簡易的に文字列で）
// "black:MINO", "white:SHIKEN" のように記録します
let triggeredFormations = new Set();

/**
 * 戦法判定のメイン関数
 * board: 現在の盤面配列
 * player: "black" | "white" (現在の手番プレイヤー、または判定したい側のプレイヤー)
 */
function checkFormations(board, player) {
    const isWhite = (player === "white");

    for (const f of FORMATION_DATA) {
        // すでにこのプレイヤーが発動済みならスキップ
        const key = `${player}:${f.id}`;
        if (triggeredFormations.has(key)) continue;

        // 全ての駒が配置通りにあるかチェック
        const isComplete = f.requirements.every(req => {
            // 先手・後手で座標を変換
            let targetX, targetY;

            if (!isWhite) {
                // 先手：定義通りの座標
                const p = pos(req.suji, req.dan);
                targetX = p.x;
                targetY = p.y;
            } else {
                // 後手：180度回転 (点対称)
                // 筋: (9 - suji) の逆 -> 9 - (10 - suji) ... 少しややこしいので配列基準で反転します
                // 配列基準: x' = 8 - x, y' = 8 - y
                const p = pos(req.suji, req.dan);
                targetX = 8 - p.x;
                targetY = 8 - p.y;
            }

            // 盤上の駒を取得
            const pieceOnBoard = board[targetY][targetX]; // board[y][x] である点に注意

            // 駒が一致するか（後手なら小文字に変換して比較）
            // 定義(req.p)は常に大文字(K, R, G...)とする
            const neededPiece = isWhite ? req.p.toLowerCase() : req.p.toUpperCase();
            
            // 成り駒でもOKにする場合（例: 龍でも四間飛車判定するか？）
            // 厳密にするなら === ですが、通常は成り駒も含めることが多いです。
            // ここでは厳密一致（成り駒はNG）として記述します。
            return pieceOnBoard === neededPiece;
        });

        if (isComplete) {
            console.log(`戦法発動！: ${f.name} (${player})`);
            executeFormationEffect(f);
            triggeredFormations.add(key);
        }
    }
}

/**
 * 演出の実行
 */
/**
 * 演出の実行
 * 必殺技用の関数 window.playSkillEffect を再利用して演出を統一する
 */
function executeFormationEffect(formation) {
    if (typeof window.playSkillEffect === "function") {
        
        // ★パスの調整処理（ここを修正！）
        // playSkillEffectは自動で "script/image/" をつけますが、
        // ファイルは "script/senpou/" にあるため、"../" を使って
        // 「imageフォルダから一つ戻って senpou フォルダに入る」ように指示します。
        
        // 元: "script/senpou/mino.png"
        // 変換後: "../senpou/mino.png"
        // 結果: "script/image/../senpou/mino.png" (＝ script/senpou/mino.png) となり成功します
        let imgName = formation.image.replace("script/", "../");
        
        // 音声も同様
        // 元: "script/senpou/mino.mp3"
        // 結果: "script/audio/../senpou/mino.mp3" (＝ script/senpou/mino.mp3)
        let audName = formation.audio.replace("script/", "../");

        // ★必殺技と同じ演出関数を実行！
        window.playSkillEffect(imgName, audName, "silver");

    } else {
        console.error("playSkillEffect 関数が見つかりません。");
    }
}

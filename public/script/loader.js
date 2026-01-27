// script/loader.js (強制集音・最終解決版)

// ★★★ ここが魔法のコードです ★★★
// エンジンが勝手に console.log で喋っても、それを捕まえて画面に送ります
var originalLog = console.log;
console.log = function(message) {
    // 1. 開発者ツールのコンソールにはそのまま出す
    originalLog.apply(console, arguments);
    
    // 2. さらに、メイン画面（将棋盤）にも転送する！
    // (これが今まで足りていなかった「配線」です)
    if (typeof message === 'string') {
         postMessage(message);
    }
};
// ★★★★★★★★★★★★★★★★★★★

// エンジン本体を読み込む
importScripts('yaneuraou.k-p.js');

// 設定（念のため残しておく）
const yaneuraouConfig = {
    pthreadPoolSize: 4, 
    mainScriptUrlOrBlob: 'yaneuraou.k-p.js',
    locateFile: (path) => path.split('/').pop(),
};

let engineInstance = null;
let commandQueue = [];

// エンジン起動
if (typeof YaneuraOu_K_P === 'function') {
    YaneuraOu_K_P(yaneuraouConfig).then((instance) => {
        engineInstance = instance;
        originalLog("★やねうら王、降臨。（起動完了）");

        // ★★★ ここに強くなるための設定を追加！ ★★★
        
        // 1. メモリ(Hash)を増やす (256MB)
        handleCommand("setoption name USI_Hash value 256");
        
        // 2. 思考の深さを制限しない (0は無制限)
        handleCommand("setoption name DepthLimit value 0");
        
        // ★★★★★★★★★★★★★★★★★★★★★★★
        
        // 溜まっていたコマンドを消化
        while (commandQueue.length > 0) {
            handleCommand(commandQueue.shift());
        }
    });
} else {
    console.error("エラー: YaneuraOu_K_P が見つかりません。");
}

// コマンド処理
function handleCommand(cmd) {
    if (engineInstance) {
        let finalCmd = cmd;

        // 思考時間を手数に応じて動的に変更する
        if (cmd.startsWith("go byoyomi")) {
            // メイン画面(yaneuraou_main.js)の moveCount を参照する
            // ※loader(Worker)内からは直接見えないため、
            // 実際には yaneuraou_main.js 側で判定して送るのが一番確実です。
            
            // ですので、ここでは「受け取った秒数をそのまま使う」形にし、
            // 指定の秒数切り替えは yaneuraou_main.js 側で行います。
            finalCmd = cmd; 
        }
        
        engineInstance.ccall('usi_command', 'number', ['string'], [finalCmd]);
    } else {
        commandQueue.push(cmd);
    }
}

onmessage = function(e) {
    handleCommand(e.data);
};
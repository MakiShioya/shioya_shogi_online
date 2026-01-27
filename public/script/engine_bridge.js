// script/engine_bridge.js (通信改善版)

const ENGINE_FILENAME = "script/loader.js";
var engineWorker = null; // グローバル変数として宣言

function initEngine() {
    console.log("エンジンを起動します: " + ENGINE_FILENAME);
    
    try {
        engineWorker = new Worker(ENGINE_FILENAME);
        
        // エンジンからのメッセージを受け取る
        engineWorker.onmessage = function(e) {
            const msg = e.data;
            
            // デバッグ用にログに出す（これで返事が来ているか分かります）
            // console.log("📣Engine:", msg); 

            // yaneuraou_main.js 側で設定した受信関数があれば呼ぶ
            if (typeof handleEngineMessage === 'function') {
                handleEngineMessage(msg);
            }
        };

        engineWorker.onerror = function(e) {
            console.error("☠️ エンジン内部でエラー発生！:", e);
        };

    } catch (error) {
        console.error("Workerの作成に失敗しました:", error);
    }
}
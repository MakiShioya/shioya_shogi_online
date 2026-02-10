// =================================================
//  BGM管理用スクリプト (bgm_manager.js)
//  items.js のデータを参照してBGMを再生します
// =================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // HTML内の <audio id="bgm"> を探す
    const bgmAudio = document.getElementById("bgm");
    if (!bgmAudio) return; 

    // items.js が読み込まれているかチェック
    if (typeof GAME_ITEMS === 'undefined') {
        console.error("エラー: script/items.js が読み込まれていません。BGMを変更できません。");
        attemptPlayBgm(bgmAudio); // とりあえずデフォルトを再生
        return;
    }

    // 一旦停止
    bgmAudio.pause();

    // Firebaseの準備ができるのを待って処理開始
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            // 1. ログインしていない場合（ゲスト）
            if (!user) {
                // items.jsの中から "bgm_default" のパスを探してセット（念のため）
                setBgmSourceById(bgmAudio, "bgm_default");
                attemptPlayBgm(bgmAudio);
                return;
            }

            // 2. ログインしている場合
            if (typeof db !== 'undefined') {
                db.collection("users").doc(user.uid).get().then((doc) => {
                    let targetBgmId = "bgm_default"; // 初期値

                    if (doc.exists) {
                        const data = doc.data();
                        // 装備中のBGMIDがあればそれを採用
                        if (data.equipped && data.equipped.bgm) {
                            targetBgmId = data.equipped.bgm;
                        }
                    }
                    
                    // IDを元に items.js からファイルパスを探してセット
                    setBgmSourceById(bgmAudio, targetBgmId);
                    
                    // 再生
                    attemptPlayBgm(bgmAudio);

                }).catch((err) => {
                    console.error("BGMデータ取得エラー:", err);
                    attemptPlayBgm(bgmAudio);
                });
            } else {
                attemptPlayBgm(bgmAudio);
            }
        });
    } else {
        // Firebaseがない環境ならデフォルト再生
        setBgmSourceById(bgmAudio, "bgm_default");
        attemptPlayBgm(bgmAudio);
    }
});

// ★ items.js (GAME_ITEMS) から ID に一致する src を探してセットする関数
function setBgmSourceById(audioElement, bgmId) {
    // GAME_ITEMSの中から、idが一致するものを探す
    const item = GAME_ITEMS.find(i => i.id === bgmId);

    if (item && item.src) {
        // 見つかったら、その src (例: "/script/audio/natsu2.mp3") をセット
        // ※パスの先頭に / があると環境によっては動かない場合があるので、必要なら調整してください
        console.log(`BGMセット: ${item.name} (${item.src})`);
        audioElement.src = item.src;
    } else {
        console.warn(`BGM ID "${bgmId}" が items.js に見つかりませんでした。`);
    }
}

// 再生を試みる関数（自動再生制限対策）
function attemptPlayBgm(audioElement) {
    audioElement.volume = 0.3; 
    const playPromise = audioElement.play();
    
    if (playPromise !== undefined) {
        playPromise.catch((error) => {
            console.log("自動再生ブロック: タップ待ち");
            const startOnTouch = () => {
                audioElement.play();
                document.body.removeEventListener('click', startOnTouch);
                document.body.removeEventListener('touchstart', startOnTouch);
            };
            document.body.addEventListener('click', startOnTouch, { once: true });
            document.body.addEventListener('touchstart', startOnTouch, { once: true });
        });
    }
}
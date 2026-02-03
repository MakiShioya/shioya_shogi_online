// ★★★ 追加した重要関数 3: 必殺技カットイン演出（修正版） ★★★
function playSkillCutIn(playerColor) {
    const charId = (playerColor === 'black') 
        ? sessionStorage.getItem('online_black_char') 
        : sessionStorage.getItem('online_white_char');

    // ★修正ポイント：画像のURL整形ロジックを強化
    // url('...') の形から、中身のパスだけを正規表現できれいに取り出します
    let rawString = getImageUrlById(charId);
    let src = "";
    
    if (rawString) {
        // "url('...')" または 'url("...")' の外側を剥がす
        src = rawString.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
    }
    
    // スキル用効果音（なければmoveSoundなどで代用も可）
    const audio = new Audio("script/audio/move.mp3"); 
    audio.play().catch(()=>{});

    const cutInImg = document.getElementById("skillCutIn");
    if(cutInImg && src) {
        cutInImg.src = src;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth;
        cutInImg.classList.add("cut-in-active");
        
        // 2秒後に消す
        setTimeout(() => {
            cutInImg.classList.remove("cut-in-active");
        }, 2000);
    }
}

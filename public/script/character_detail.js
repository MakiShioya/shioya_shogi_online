// script/character_detail.js

// キャラクター情報のデータベース
const charData = {
  // ■いつもの（デフォルト）
  "default": {
    name: "キャラA",
    image: "script/image/karui_1p.PNG",
    skillName: "シルバーアーマー",
    skillDesc: "自身の「銀」「成銀」「成桂」「成香」のうち一つを選び、自分の玉の周囲８マスから１マスを選択し、移動させる。手番が終わる。<br>発動条件：30手以降 / 1局に1回のみ"
  },
  
  // ■熱血（char_a）
  "char_a": {
    name: "キャラB",
    image: "script/image/char_a.png",
    skillName: "熱烈な応援",
    skillDesc: "自分の「銀」「桂」「香」を１枚選択し、その場で成る。<br>発動条件：なし / 1局に2回のみ"
  },

  // ■冷静（char_b）
  "char_b": {
    name: "キャラC",
    image: "script/image/char_b.png",
    skillName: "ブループリント",
    skillDesc: "振り飛車限定の必殺技。自分の飛車か角を１枚選択し、その場で成る。<br>発動条件：振り飛車 / 1局に1回のみ"
  }
};

// ページ読み込み時に実行
window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const charId = urlParams.get('id') || 'default';

  // 画面表示処理
  const data = charData[charId];
  if (data) {
    document.getElementById("charName").textContent = data.name;
    
    // 画像取得（エラー対策含む）
    const img = document.getElementById("charImage");
    img.src = data.image;
    img.onerror = function() { this.src = "script/image/karui_1p.PNG"; };
    
    document.getElementById("skillName").textContent = "必殺技：" + data.skillName;
    document.getElementById("skillDesc").innerHTML = data.skillDesc;
  }
  
  // 決定ボタン用にIDを一時保存
  sessionStorage.setItem('temp_selected_char', charId);
};

// 「決定」ボタンが押されたときの処理
function decideCharacter() {
  // 1. URLパラメータからモードとフェーズ（段階）を取得
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');  // 'practice', 'cpu', 'pvp'
  const phase = urlParams.get('phase'); // PvP用: '1' or '2'

  // 2. 選択されたキャラIDを取得
  const charId = sessionStorage.getItem('temp_selected_char');

  // --- モードごとの分岐 ---

  if (mode === 'practice') {
    // ■ 練習モード
    sessionStorage.setItem('char_black', charId);
    window.location.href = 'index.html?menu=practice';
  } 
  else if (mode === 'cpu') {
    // ■ ひとりで（CPU）モード
    sessionStorage.setItem('char_black', charId);
    window.location.href = 'index.html?menu=cpu';
  } 
  else if (mode === 'pvp') {
    // ■ ふたりで（PvP）モード
    
    if (phase === '2') {
      // 2人目（後手）を選んだ場合
      sessionStorage.setItem('char_white', charId); // ★後手として保存
      window.location.href = 'player_vs_player.html'; // ゲーム開始
    } else {
      // 1人目（先手）を選んだ場合、または phase がない場合
      sessionStorage.setItem('char_black', charId); // ★先手として保存
      // 後手を選んでもらうために一覧画面へ戻る（phase=2をつける）
      window.location.href = 'character.html?mode=pvp&phase=2';
    }
  } 
  else {
    // エラー時はタイトルへ
    window.location.href = 'index.html';
  }

}
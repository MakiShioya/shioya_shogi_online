// script/character_detail.js

// キャラクター情報のデータベース
const charData = {
  // ■いつもの（デフォルト）
  "default": {
    name: "キャラA",
    image: "script/image/karui_1p.PNG",
    skillName: "シルバーアーマー",
    skillDesc: "自身の「銀」「成銀」「成桂」「成香」のうち一つを選び、自分の玉の周囲８マスから１マスを選択し、移動させる。手番が終わる。<br>発動条件：なし<br>発動可能：1回"
  },
  
  // ■熱血（char_a）
  "char_a": {
    name: "キャラB",
    image: "script/image/char_a.png",
    skillName: "熱烈な応援",
    skillDesc: "自分の「銀」「桂」「香」を１枚選択し、その場で成る。<br>この手番中は、「この手番にこの必殺技で成った駒」で、相手の駒を取ることはできない。<br>発動条件：なし<br>発動可能：2回"
  },

  // ■冷静（char_b）
  "char_b": {
    name: "キャラC",
    image: "script/image/char_b.png",
    skillName: "ブループリント",
    skillDesc: "振り飛車限定の必殺技。自分の飛車か角を１枚選択し、その場で成る。<br>この手番中は、「この手番にこの必殺技で成った駒」で、相手の駒を取ることはできない。<br>発動条件：10手目以内に振り飛車にしていること。<br>発動可能：1回"
  },

  // ■町田（char_d）
  "char_d": {
    name: "キャラD",
    image: "script/image/char_d.png",
    skillName: "タイムワープ",
    skillDesc: "ひとつ前の自分の番まで時を戻す。相手の必殺技を巻き込んで戻ることはできない。<br>発動条件：直前の手番に相手が必殺技を使っていないこと。<br>発動可能：1回"
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
  const mode = urlParams.get('mode');  // 'online', 'practice', 'cpu', 'pvp'
  const phase = urlParams.get('phase'); // PvP用: '1' or '2'

  // 2. 選択されたキャラIDを取得
  const charId = sessionStorage.getItem('temp_selected_char');

  // --- モードごとの分岐 ---

  if (mode === 'online') {
    // ■ オンライン対戦
    sessionStorage.setItem('my_character', charId);
    
    // ▼▼▼ 修正箇所：ここをロビーへの移動に変更 ▼▼▼
    window.location.href = 'online_lobby.html';
    // ▲▲▲ 修正ここまで ▲▲▲
  }
  else if (mode === 'practice') {
    // ■ 練習モード
    sessionStorage.setItem('char_black', charId);
    // ★修正：home.html に戻り、自動的に「練習相手選択メニュー」を開かせる
    // (home.html側でこのURLパラメータを検知する処理が必要です。後述します)
    window.location.href = 'home.html?open=practiceMenu';
  } 
  else if (mode === 'cpu') {
    // ■ ひとりで（CPU）モード
    sessionStorage.setItem('char_black', charId);
    // ★修正：home.html に戻り、自動的に「CPUモード選択メニュー」を開かせる
    window.location.href = 'home.html?open=onePlayerModeSelect';
  } 
  else if (mode === 'pvp') {
    // ■ ふたりで（PvP）モード
    
    if (phase === '2') {
      // 2人目（後手）を選んだ場合
      sessionStorage.setItem('char_white', charId); 
      window.location.href = 'player_vs_player.html'; 
    } else {
      // 1人目（先手）を選んだ場合
      sessionStorage.setItem('char_black', charId); 
      // 後手を選んでもらうために一覧画面へ戻る
      window.location.href = 'character.html?mode=pvp&phase=2';
    }
  } 
  else {
    // エラー時はホームへ
    window.location.href = 'home.html';
  }
}

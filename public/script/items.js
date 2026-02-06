// script/items.js
// ゲーム内の全アイテムデータ定義

// ★★★ 注意： const GAME_ITEMS = ... はファイル内で1回だけ書く必要があります ★★★

const GAME_ITEMS = [
  // --- 駒のデザイン ---
  {
    id: "piece_default",
    name: "標準の駒",
    price: 0,
    type: "piece",
    image: "script/image/koma.png",
    desc: "いつも使っている標準的な駒です。"
  },
  {
    id: "piece_dot",
    name: "駒２",
    price: 99999,
    type: "piece",
    image: "script/image/dot_preview.png",
    desc: "レトロゲーム風のドット絵駒です。"
  },
  {
    id: "piece_gold_style",
    name: "駒３",
    price: 99999,
    type: "piece",
    placeholderText: "金",
    desc: "成金趣味全開の黄金に輝く駒です。"
  },

  // --- 盤のデザイン ---
  
  {
    id: "board_default",
    name: "標準の将棋盤",
    price: 0,
    type: "board",
    image: "script/image/shogiban.png",
    desc: "いつもの将棋盤です。"
  },
  {
    id: "board_default",
    name: "ヨーロッパの標識",
    price: 1000,
    type: "board",
    image: "script/image/hyoshiki.PNG",
    desc: "おなじみの標識"
  },
  {
    id: "board_wood_dark",
    name: "将棋盤３",
    price: 99999,
    type: "board",
    placeholderText: "黒木",
    desc: "重厚感のある暗い色の木製盤です。"
  },

  {
    id: "bgm_default",
    name: "いつもの曲",
    price: 0,
    type: "bgm",
    src: "script/audio/natsu2.mp3", // デフォルトの曲パス
    desc: "標準のBGMです。"
  },
  {
    id: "bgm_rock",
    name: "曲２",
    price: 99999,
    type: "bgm",
    src: "script/audio/rock.mp3", // ★新しく用意したmp3ファイルのパス
    desc: "激しい戦いを予感させるロックな曲です。",
    // ショップで画像がないと寂しいので、音符マークなどの画像を指定すると良いです
    image: "script/image/music_icon.png" 
  },
  {
    id: "bgm_piano",
    name: "曲３",
    price: 99999,
    type: "bgm",
    src: "script/audio/piano.mp3",
    desc: "集中力を高める静かなピアノ曲です。",
    image: "script/image/music_icon.png"
  }

];

// アイテムIDからデータを探すヘルパー関数
function getItemById(id) {
  if (typeof GAME_ITEMS === 'undefined') return null;
  return GAME_ITEMS.find(item => item.id === id);
}





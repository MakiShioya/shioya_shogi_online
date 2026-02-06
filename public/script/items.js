// script/items.js
// ゲーム内の全アイテムデータ定義

// ★★★ 注意： const GAME_ITEMS = ... はファイル内で1回だけ書く必要があります ★★★

const GAME_ITEMS = [
  // --- 駒のデザイン ---
  {
    id: "piece_default",
    name: "木製の駒",
    price: 0,
    type: "piece",
    image: "/script/image/koma.png",
    desc: "いつも使っている<br>標準的な駒です"
  },
  {
    id: "piece_gold",
    name: "金の駒",
    price: 500,
    type: "piece",
    image: "/script/image/koma_gold.png",
    desc: "金色の駒です"
  },
  {
    id: "piece_dot",
    name: "駒２",
    price: 99999,
    type: "piece",
    placeholderText: "準備中",
    desc: "準備中です"
  },
  {
    id: "piece_gold_style",
    name: "駒３",
    price: 99999,
    type: "piece",
    placeholderText: "準備中",
    desc: "準備中です"
  },

  // --- 盤のデザイン ---
  
  {
    id: "board_default",
    name: "標準の将棋盤",
    price: 0,
    type: "board",
    image: "/script/image/shogiban.png",
    desc: "いつもの将棋盤です"
  },
  {
    id: "hyoshiki",
    name: "ヨーロッパの標識",
    price: 1000,
    type: "board",
    image: "/script/image/hyoshiki.PNG",
    desc: "おなじみの標識"
  },
  {
    id: "board_komiya",
    name: "こみやの将棋盤",
    price: 1000,
    type: "board",
    image: "/script/image/komiya_icon.png",
    desc: "こみやの将棋盤です"
  },
  {
    id: "board_wood_dark",
    name: "将棋盤３",
    price: 99999,
    type: "board",
    placeholderText: "準備中",
    desc: "準備中です"
  },

  {
    id: "bgm_default",
    name: "Summer",
    price: 0,
    type: "bgm",
    src: "/script/audio/natsu2.mp3",
    desc: "「夏がやってきた！」<br>いつものBGMです",
    image: "script/image/music_icon.png" 
  },
  {
    id: "Tchaikovsky1",
    name: "チャイコフスキー<br>交響曲第五番",
    price: 100,
    type: "bgm",
    src: "/script/audio/Tchaikovsky1.mp3",
    desc: "第一楽章",
    image: "script/image/Tchaikovsky_5.png" 
  },
  {
    id: "Tchaikovsky2",
    name: "チャイコフスキー<br>交響曲第五番",
    price: 100,
    type: "bgm",
    src: "/script/audio/Tchaikovsky2.mp3",
    desc: "第二楽章",
    image: "script/image/Tchaikovsky_5.png" 
  },
  {
    id: "Tchaikovsky3",
    name: "チャイコフスキー<br>交響曲第五番",
    price: 100,
    type: "bgm",
    src: "/script/audio/Tchaikovsky3.mp3",
    desc: "第三楽章",
    image: "script/image/Tchaikovsky_5.png" 
  },
  {
    id: "Tchaikovsky4",
    name: "チャイコフスキー<br>交響曲第五番",
    price: 100,
    type: "bgm",
    src: "/script/audio/Tchaikovsky4.mp3", 
    desc: "第四楽章",
    image: "script/image/Tchaikovsky_5.png" 
  },
  {
    id: "Happy_Curry_Christmas",
    name: "Happy Curry Christmas",
    price: 100,
    type: "bgm",
    src: "/script/audio/Happy_Curry_Christmas.mp3", // ★新しく用意したmp3ファイルのパス
    desc: "カレー味の<br>クリスマスソング",
    // ショップで画像がないと寂しいので、音符マークなどの画像を指定すると良いです
    image: "script/image/music_icon.png" 
  },
  {
    id: "bgm_piano",
    name: "曲３",
    price: 99999,
    type: "bgm",
    src: "/script/audio/piano.mp3",
    desc: "準備中です",
    image: "script/image/music_icon.png"
  }

];

// アイテムIDからデータを探すヘルパー関数
function getItemById(id) {
  if (typeof GAME_ITEMS === 'undefined') return null;
  return GAME_ITEMS.find(item => item.id === id);
}






















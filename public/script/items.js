// script/items.js
// ゲーム内の全アイテムデータ定義

const GAME_ITEMS = [
  // --- 駒のデザイン ---
  {
    id: "piece_default",
    name: "標準の駒",
    price: 0, // 初期装備なので0G
    type: "piece",
    image: "script/image/koma.png", // 仮のパス（既存の画像があればそれを）
    desc: "いつも使っている標準的な駒です。"
  },
  {
    id: "piece_dot",
    name: "ドット絵の駒",
    price: 1000,
    type: "piece",
    image: "script/image/dot_preview.png", // プレビュー用画像
    desc: "レトロゲーム風のドット絵駒です。"
  },
  {
    id: "piece_gold_style",
    name: "黄金の駒",
    price: 5000,
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
    id: "board_wood_dark",
    name: "黒檀の将棋盤",
    price: 2500,
    type: "board",
    placeholderText: "黒木",
    desc: "重厚感のある暗い色の木製盤です。"
  }
];

// アイテムIDからデータを探すヘルパー関数
function getItemById(id) {
  return GAME_ITEMS.find(item => item.id === id);
}// script/items.js
// ゲーム内の全アイテムデータ定義

const GAME_ITEMS = [
  // --- 駒のデザイン ---
  {
    id: "piece_default",
    name: "標準の駒",
    price: 0, // 初期装備なので0G
    type: "piece",
    image: "script/image/koma.png", // 仮のパス（既存の画像があればそれを）
    desc: "いつも使っている標準的な駒です。"
  },
  {
    id: "piece_dot",
    name: "ドット絵の駒",
    price: 1000,
    type: "piece",
    image: "script/image/dot_preview.png", // プレビュー用画像
    desc: "レトロゲーム風のドット絵駒です。"
  },
  {
    id: "piece_gold_style",
    name: "黄金の駒",
    price: 5000,
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
    id: "board_wood_dark",
    name: "黒檀の将棋盤",
    price: 2500,
    type: "board",
    placeholderText: "黒木",
    desc: "重厚感のある暗い色の木製盤です。"
  }
];

// アイテムIDからデータを探すヘルパー関数
function getItemById(id) {
  return GAME_ITEMS.find(item => item.id === id);
}
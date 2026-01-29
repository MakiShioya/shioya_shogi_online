
// globals.js

// 設定
let cpuEnabled = true;
let cpuSide = "white";

// グローバル変数
let bgm;
let moveSound, promoteSound;
let boardState = [
  ["l","n","s","g","k","g","s","n","l"],
  ["","r","","","","","","b",""],
  ["p","p","p","p","p","p","p","p","p"],
  ["","","","","","","","",""],
  ["","","","","","","","",""],
  ["","","","","","","","",""],
  ["P","P","P","P","P","P","P","P","P"],
  ["","B","","","","","","R",""],
  ["L","N","S","G","K","G","S","N","L"]
];

let hands = { black: [], white: [] };
let turn = "black";
let selected = null;
let legalMoves = [];
let history = [];
let positionHistory = {};
let repetitionHistory = {};
let gameOver = false;
let winner = null;
let moveCount = 0;
let kifu = [];
let lastMoveTo = null;
let isSimulating = false;
let lastPlayerMove = null;

// 定数
const pieceName = {
  "P": "歩","L":"香","N":"桂","S":"銀","G":"金","B":"角","R":"飛","K":"玉",
  "+P":"と","+L":"成香","+N":"成桂","+S":"成銀","+B":"馬","+R":"龍"
};

// --- 必殺技用グローバル変数 ---
let skillUsed = false;       // 必殺技をすでに使ったか
let isSkillTargeting = false; // 必殺技のターゲット選択中か
let currentSkill = null;     // 現在のプレイヤーが持っている必殺技オブジェクト

// ★★★ 追加：駒のスタイル（色など）を管理する配列 ★★★
// 9x9 の配列を作り、初期値はすべて null にする
let pieceStyles = Array.from({length: 9}, () => Array(9).fill(null));

// ★★★ 必殺技の回数管理用 ★★★
let skillUseCount = 0; // 現在のプレイヤーが、この対局で何回技を使ったか

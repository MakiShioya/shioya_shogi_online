// globals.js

// 設定
let cpuEnabled = false;
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
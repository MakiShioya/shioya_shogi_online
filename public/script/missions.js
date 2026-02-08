// script/missions.js

const GAME_MISSIONS = [
  // --- 勝利数ミッション ---
  {
    id: "mission_win_1",
    title: "テスト１",
    desc: "対局で1回勝利する",
    type: "win",      // 判定タイプ
    target: 1,        // 目標回数
    rewardType: "gold",
    rewardValue: 100
  },
  {
    id: "mission_win_10",
    title: "テスト２",
    desc: "対局で累計10回勝利する",
    type: "win",
    target: 10,
    rewardType: "gold",
    rewardValue: 500
  },
  
  // --- 行動ミッション ---
  {
    id: "mission_play_1",
    title: "テスト３",
    desc: "対局を1回行う（勝敗問わず）",
    type: "play",
    target: 1,
    rewardType: "gold",
    rewardValue: 50
  },
  {
    id: "mission_analysis_first",
    title: "テスト４",
    desc: "解析機能を初めて利用する",
    type: "use_analysis",
    target: 1,
    rewardType: "item", // アイテム報酬の例
    rewardValue: "board_isi",
    rewardName: "大理石の将棋盤" // 表示用
  }
];
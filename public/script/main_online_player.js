// script/main_online_player.js (キャラクター同期 完全版)


// script/main_online_player.js (キャラクター同期 + アカウント認証版)

// ★★★ 1. 自動接続をオフにしてSocket初期化（認証を待つため） ★★★
const socket = io({ autoConnect: false });

// DOM要素の参照
const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");

// ★ 自分の選んだキャラIDを取得（なければデフォルト）
const myCharId = sessionStorage.getItem('my_character') || 'default';

// ★★★ 2. Firebaseの認証状態を監視し、ログインしていれば接続開始 ★★★
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // --- ログイン済み ---
            console.log("ログイン確認:", user.uid);
            
            // ユーザー名を保存（表示用）
            const displayName = user.displayName || (user.email ? user.email.split('@')[0] : "名無し");
            localStorage.setItem('shogi_username', displayName);

            // ★ここで初めてSocket接続を開始
            // queryオプションを使うと、接続時のハンドシェイクでIDをサーバーに渡せます（念のため）
            socket.io.opts.query = { userId: user.uid };
            socket.connect();

            // 接続後の処理をセットアップ
            setupSocketListeners(user.uid);

        } else {
            // --- 未ログイン ---
            alert("オンライン対戦をするにはログインが必要です。");
            window.location.href = "index.html"; // ホームへ強制送還
        }
    });
} else {
    console.error("Firebaseが読み込まれていません。");
    alert("エラー：認証システムが動きません。");
}

// ★★★ 3. 接続確立後の処理を関数化 ★★★
function setupSocketListeners(myUserId) {
    
    socket.on('connect', () => {
        console.log("サーバーに接続しました。Account ID:", myUserId);

        const urlParams = new URLSearchParams(window.location.search);
        let roomId = urlParams.get('room');
        if (!roomId) {
            roomId = "default";
        }

        console.log(`部屋 [${roomId}] に入室します (UID: ${myUserId}, Char: ${myCharId})`);
        localStorage.setItem('current_shogi_room', roomId);

        // ★ここで FirebaseのUID をサーバーに送る
        socket.emit('enter game', { 
            roomId: roomId, 
            userId: myUserId, // ★これが絶対的な身分証明になります
            charId: myCharId 
        });

        const name = localStorage.getItem('shogi_username') || "ゲスト";
        socket.emit('chat message', {
            text: `${name}さんが入室しました`,
            isSystem: true
        });
    });
}

// ----------------------------------------------------
// ここから下は、変数定義
// ----------------------------------------------------

// 変数定義
let lastSkillKifu = ""; 
let p1Skill = null;      // 先手の技
let p2Skill = null;      // 後手の技
let p1SkillCount = 0;   
let p2SkillCount = 0;   
let pendingMove = null; 
let myRole = null;
let endReason = null;
let isGameStarted = false;
let hasShownEndEffect = false;
// 変数定義
let remainingTime = { black: 1200, white: 1200 }; // 20分 = 1200秒
let lastReceivedTime = Date.now(); // 同期用
window.skillUsed = false;
window.isCaptureRestricted = false;

// 初期化処理
window.addEventListener("load", () => {
  cpuEnabled = false;
  bgm = document.getElementById("bgm");
  
  // 自分のキャラ名の表示（オーバーレイ用）は、ローカル情報なのでそのままでOK
  const myCharId = sessionStorage.getItem('my_character') || 'default';
  const charNameMap = {
      'default': 'キャラA', 
      'char_a': 'キャラB',
      'char_b': 'キャラC',
      'char_d': 'キャラD'
  };
  const myCharName = charNameMap[myCharId] || "不明なキャラ";
  const displaySpan = document.getElementById("myCharNameDisplay");
  if (displaySpan) displaySpan.textContent = myCharName;

  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  // ★重要変更★
  // これまではとりあえず初期化していましたが、それをやめます。
  // 引数に null を渡すことで、「まだキャラは未定」という状態にします。
  initSkills(null, null); 

  if (resignBtn) resignBtn.addEventListener("click", resignGame);

  playBGM();
  statusDiv.textContent = "対戦相手の入室を待っています..."; 
  render();

  if (typeof showKifu === "function") showKifu();

  const key = getPositionKey();
  positionHistory[key] = 1;
});

// ----------------------------------------------------
// ★★★ サーバーからの通信受信処理 ★★★
// ----------------------------------------------------


// ★追加：サーバーから強制解散を命じられた場合
socket.on('force room close', () => {
    alert("対局終了から一定時間が経過したため、ルームを閉じます。");
    localStorage.removeItem('current_shogi_room'); // 復帰用データも消す
    window.location.href = "index.html"; // ホームへ強制送還
});


socket.on('role assigned', (role) => {
    myRole = role;
    let roleName = "観戦者";
    if (myRole === "black") roleName = "先手 (▲)";
    if (myRole === "white") roleName = "後手 (△)";
    
    statusDiv.textContent = `接続しました。待機中... （あなたは ${roleName} です）`;

    if (myRole === "white") {
        document.body.classList.add("view-white");
    } else {
        document.body.classList.remove("view-white");
    }
    updateHandLayout(myRole);
    render();
});

// ★★★ 追加：部屋の状況（キャラ変更など）が更新されたら反映する ★★★
socket.on('update room status', (data) => {
    console.log("部屋の状態更新を受信:", data);

    // 1. キャラクター情報の更新
    // サーバーから送られてきた最新のキャラIDを使って、画面とスキルを更新します
    if (data.blackChar && data.whiteChar) {
        initSkills(data.blackChar, data.whiteChar);
    }

    // 2. 待機中のステータス表示更新（対局が始まっていない場合）
    if (!isGameStarted) {
        let msg = "待機中...";
        
        // 相手がいるかどうかの判定
        const isOpponentPresent = (myRole === 'black' && data.whiteId) || (myRole === 'white' && data.blackId);
        
        if (isOpponentPresent) {
             // 準備完了しているか
             const amIReady = (myRole === 'black' ? data.blackReady : data.whiteReady);
             const isOpponentReady = (myRole === 'black' ? data.whiteReady : data.blackReady);
             
             msg = "対戦相手が入室しています。";
             if (amIReady) msg += " [あなた: 準備完了]";
             else msg += " [あなた: 未完了]";
             
             if (isOpponentReady) msg += " [相手: 準備完了]";
             else msg += " [相手: 未完了]";
        } else {
            msg = "対戦相手の入室を待っています...";
        }
        
        statusDiv.textContent = msg;
    }
});

// ★★★ 修正：対局開始（キャラ情報付き） ★★★
socket.on('game start', (data) => {
    console.log("対局開始！キャラ情報を受信:", data);
    
    // 受信した正しいキャラIDでスキルを再設定
    if (data && data.blackCharId && data.whiteCharId) {
        initSkills(data.blackCharId, data.whiteCharId);
    }
    
    // 演出開始
    initGameSequence(); 
});

// main_online_player.js に追加

// ★★★ 修正：復元時に「時間」も同期する ★★★
socket.on('restore game', (savedState) => {
    console.log("サーバーからゲーム状態を復元します:", savedState);

    boardState = savedState.boardState;
    hands = savedState.hands;
    turn = savedState.turn;
    moveCount = savedState.moveCount;
    kifu = savedState.kifu;
    
    lastMoveTo = savedState.lastMoveTo || null;
    lastMoveFrom = savedState.lastMoveFrom || null;

    p1SkillCount = savedState.p1SkillCount || 0;
    p2SkillCount = savedState.p2SkillCount || 0;

    if (savedState.blackCharId && savedState.whiteCharId) {
        initSkills(savedState.blackCharId, savedState.whiteCharId);
    }

    // ★追加：時間の復元
    if (savedState.remainingTime) {
        remainingTime = savedState.remainingTime;
    }

    isGameStarted = true;
    gameOver = false;
    
    const overlay = document.getElementById("waitingOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }

    // 時間表示を更新してからタイマー再開
    updateTimeDisplay();
    render();
    statusDiv.textContent = `再接続しました。現在 ${moveCount} 手目です。`;
    startTimer();
    
    if (myRole) {
        updateHandLayout(myRole);
        if (myRole === "white") {
            document.body.classList.add("view-white");
        } else {
            document.body.classList.remove("view-white");
        }
    }
});

// ★★★ 追加：サーバーからの定期的な時間同期を受け取る ★★★
socket.on('sync time', (times) => {
    remainingTime = times;
    updateTimeDisplay();
});

socket.on('shogi move', (data) => {
  // ★★★ 修正：TimeWarp（強制巻き戻し）の場合は、盤面を丸ごと復元する ★★★
  if (data.isTimeWarp) {
      console.log("TimeWarpを受信。盤面を強制同期します。");
      const state = data.gameState;

      // サーバーから送られてきた「戻った後の状態」で上書き
      boardState = state.boardState;
      hands = state.hands;
      turn = state.turn;
      moveCount = state.moveCount;
      kifu = state.kifu;
      p1SkillCount = state.p1SkillCount;
      p2SkillCount = state.p2SkillCount;

      // エフェクトなどは skill activate で処理済みなので、ここでは描画更新のみ
      render();
      startTimer();
      
      // ログ表示
      statusDiv.textContent = "相手が時を戻しました！";
  } 
  else {
      // 通常の駒移動
      executeMove(data.sel, data.x, data.y, data.promote, true);
  }
});

socket.on('skill activate', (data) => {
  console.log("相手の必殺技を受信:", data);
  const skillToUse = (data.turn === "black") ? p1Skill : p2Skill;
  if (!skillToUse) return;

  currentSkill = skillToUse; 
  legalMoves = [{ x: data.x, y: data.y }];
  isSkillTargeting = true;

  const result = skillToUse.execute(data.x, data.y);

  if (data.isFinished) {
      processSkillAfterEffect(skillToUse, result, data.turn);
  } else {
      legalMoves = skillToUse.getValidTargets();
      render(); 
  }
});

// ★★★ 修正：時間切れなどの理由を受け取れるようにする ★★★
socket.on('game resign', (data) => {
    const winColor = (data.loser === "black") ? "white" : "black";
    // data.reason (timeout, disconnect, default) を渡す
    resolveResignation(winColor, data.reason);
});

socket.on('game reset', () => {
  resetGame(); 
});


// ----------------------------------------------------
// ★★★ 関数エリア ★★★

// 開始演出
function initGameSequence() {
  // ★★★ 追加：待機画面を隠す処理 ★★★
    const overlay = document.getElementById("waitingOverlay");
    if (overlay) {
        overlay.style.opacity = "0"; // 透明にする
        setTimeout(() => {
            overlay.style.display = "none"; // 完全に消す
        }, 500);
    }

    const cutInImg = document.getElementById("skillCutIn");
    const isSente = (myRole !== "white");
    const imgPath = isSente ? "script/image/sente.PNG" : "script/image/gote.PNG";
    const audioPath = isSente ? "script/audio/sente.mp3" : "script/audio/gote.mp3";

    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play().catch(e => {});

    if (cutInImg) {
        cutInImg.src = imgPath;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth; 
        cutInImg.classList.add("cut-in-active");
    }

    setTimeout(() => {
        if (cutInImg) cutInImg.classList.remove("cut-in-active");
        startActualGame();
    }, 1000);
}

function startActualGame() {
    isGameStarted = true;
    statusDiv.textContent = "対局開始！";
    startTimer();
    render();
}

// ★★★ 修正：引数でIDを受け取って設定する形に変更 ★★★
function initSkills(blackId, whiteId) {
    // 画面表示用に一時保存（applyPlayerImageで使う）
    sessionStorage.setItem('online_black_char', blackId);
    sessionStorage.setItem('online_white_char', whiteId);

    // 先手のスキル設定
    if (blackId === 'default' && typeof CharItsumono !== 'undefined') p1Skill = CharItsumono.skill;
    else if (blackId === 'char_a' && typeof CharNekketsu !== 'undefined') p1Skill = CharNekketsu.skill;
    else if (blackId === 'char_b' && typeof CharReisei !== 'undefined') p1Skill = CharReisei.skill;
    else if (blackId === 'char_d' && typeof CharMachida !== 'undefined') p1Skill = CharMachida.skill;

    // 後手のスキル設定
    if (whiteId === 'default' && typeof CharItsumono !== 'undefined') p2Skill = CharItsumono.skill;
    else if (whiteId === 'char_a' && typeof CharNekketsu !== 'undefined') p2Skill = CharNekketsu.skill;
    else if (whiteId === 'char_b' && typeof CharReisei !== 'undefined') p2Skill = CharReisei.skill;
    else if (whiteId === 'char_d' && typeof CharMachida !== 'undefined') p2Skill = CharMachida.skill;
  
    // 画像反映
    applyPlayerImage();
    syncGlobalSkillState();
}

function syncGlobalSkillState() {
  // 現在の手番に合わせて、使うスキルを切り替える
  if (turn === "black") {
    currentSkill = p1Skill;
    skillUseCount = p1SkillCount; 
  } else {
    currentSkill = p2Skill;
    skillUseCount = p2SkillCount; 
  }

  // 使用回数チェック
  if (currentSkill) {
      const max = currentSkill.maxUses || 1;
      window.skillUsed = (skillUseCount >= max);
  } else {
      window.skillUsed = true;
  }
  updateSkillButton();
}

function updateSkillButton() {
    const skillBtn = document.getElementById("skillBtn");
    if (!skillBtn) return;

    // 1. 「現在のターン」ではなく「自分の役割(myRole)」に基づいて表示するスキルを決める
    let mySkill = null;
    let myUseCount = 0;

    if (myRole === "black") {
        mySkill = p1Skill;
        myUseCount = p1SkillCount;
    } else if (myRole === "white") {
        mySkill = p2Skill;
        myUseCount = p2SkillCount;
    } else {
        // 観戦者などの場合はボタンを表示しない
        skillBtn.style.display = "none";
        return;
    }

    // 2. 自分のスキルが存在する場合のみボタンを表示・更新
    if (mySkill) {
        skillBtn.style.display = "inline-block";
        skillBtn.textContent = mySkill.name; // 常に自分の技名を表示

        // デザインの適用
        if (mySkill.buttonStyle) {
            Object.assign(skillBtn.style, mySkill.buttonStyle);
        } else {
            skillBtn.style.backgroundColor = "#ff4500";
            skillBtn.style.color = "white";
            skillBtn.style.border = "none";
        }

        // 3. 使用回数上限のチェック（自分の使用回数を見る）
        const max = mySkill.maxUses || 1;
        const isUsedUp = (myUseCount >= max);

        // 4. ボタンの有効/無効の切り替え
        // 「自分の番ではない」 または 「回数を使い切っている」 場合は押せないようにする
        if (turn !== myRole || isUsedUp) {
            skillBtn.disabled = true;
            skillBtn.style.opacity = 0.5;

            // 使い切った場合の色変更（オプション）
            if (isUsedUp) {
                skillBtn.style.backgroundColor = "#ccc";
                skillBtn.style.border = "1px solid #999";
            }
        } else {
            // 自分の番で、かつ使える状態
            skillBtn.disabled = false;
            skillBtn.style.opacity = 1.0;
        }

    } else {
        // スキルがないキャラの場合
        skillBtn.style.display = "none";
    }
}

function toggleSkillMode() {
  if (gameOver) return;
  if (myRole && turn !== myRole) return;
  if (!currentSkill) return;
  if (isSkillTargeting) return;
  
  if (window.skillUsed) {
    alert("この対局では、必殺技はもう使えません。");
    return;
  }
  if (!currentSkill.canUse()) {
    alert("現在は必殺技の発動条件を満たしていません。");
    return;
  }

  const modal = document.getElementById("skillModal");
  if (modal) modal.style.display = "flex";
}

function confirmSkillActivate() {
  closeSkillModal();
  if (currentSkill.reset) currentSkill.reset();
  selected = null;
  
  const targets = currentSkill.getValidTargets();
  if (!targets || targets.length === 0) {
      alert("この必殺技で動かせる有効な場所がありません。");
      isSkillTargeting = false;
      return; 
  }

  isSkillTargeting = true;
  legalMoves = targets;

  const boardTable = document.getElementById("board");
  if (boardTable) boardTable.classList.add("skill-targeting-mode");
  
  render();
  statusDiv.textContent = `必殺技【${currentSkill.name}】：発動するマスを選んでください`;
}

function closeSkillModal() {
  const modal = document.getElementById("skillModal");
  if (modal) modal.style.display = "none";
}

// ★★★ 修正：サーバーから送られてきたIDを使って画像を表示 ★★★
function applyPlayerImage() {
  const blackHandBox = document.getElementById("blackHandBox");
  // initSkills で保存したIDを使う（まだ無ければ null になる）
  const charBlackId = sessionStorage.getItem('online_black_char');
  
  if (blackHandBox) {
    const bgUrl = getImageUrlById(charBlackId);
    // ★修正: URLがあれば表示、なければ 'none' で確実に消す
    blackHandBox.style.backgroundImage = bgUrl || 'none';
  }

  const whiteHandBox = document.getElementById("whiteHandBox");
  const charWhiteId = sessionStorage.getItem('online_white_char');
  
  if (whiteHandBox) {
    const bgUrl = getImageUrlById(charWhiteId);
    // ★修正: URLがあれば表示、なければ 'none' で確実に消す
    whiteHandBox.style.backgroundImage = bgUrl || 'none';
  }
}

function getImageUrlById(charId) {
  if (charId === 'char_a') return "url('script/image/char_a.png')";
  if (charId === 'char_b') return "url('script/image/char_b.png')";
  if (charId === 'default') return "url('script/image/karui_1p.PNG')";
  if (charId === 'char_d') return "url('script/image/char_d.png')";
  return null;
}

// --- その他の共通関数（変更なし） ---

function playBGM() {
  if (!bgm) return;
  bgm.volume = 0.3;
  bgm.play().catch(() => {
    document.addEventListener("click", () => {
      bgm.play().catch(e => {});
    }, { once: true });
  });
}

function stopBGM() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

let timerInterval = null;
let currentSeconds = 0;

// --- 新・タイマー関連 ---
let timerInterval = null;

function startTimer() {
    stopTimer();
    updateTimeDisplay();
    
    // 1秒ごとに減らす（表示上の演出）
    // ※本当の時間はサーバーが管理しているので、あくまで目安です
    timerInterval = setInterval(() => {
        if (remainingTime[turn] > 0) {
            remainingTime[turn]--;
            updateTimeDisplay();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimeDisplay() {
    const blackTimer = document.getElementById("blackTimer");
    const whiteTimer = document.getElementById("whiteTimer");
    
    if (blackTimer) blackTimer.textContent = "▲先手: " + formatTime(remainingTime.black);
    if (whiteTimer) whiteTimer.textContent = "△後手: " + formatTime(remainingTime.white);
    
    // 手番の方を赤くするなど強調しても良い
    if (turn === 'black') {
        if(blackTimer) blackTimer.style.fontWeight = "bold";
        if(whiteTimer) whiteTimer.style.fontWeight = "normal";
    } else {
        if(blackTimer) blackTimer.style.fontWeight = "normal";
        if(whiteTimer) whiteTimer.style.fontWeight = "bold";
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- 修正版 render関数 (Online Hybrid Version) ---
function render() {
  if (gameOver) {
    if (!hasShownEndEffect && winner) {
        playGameEndEffect(winner);
        hasShownEndEffect = true; 
    }
    if (endReason) {
        statusDiv.textContent = endReason;
    } else {
        if (winner === "black") statusDiv.textContent = "先手の勝ちです！";
        else if (winner === "white") statusDiv.textContent = "後手の勝ちです！";
        else statusDiv.textContent = "引き分けです。";
    }
    checkStatusDiv.textContent = "";

    if (!document.getElementById("resetBtn")) {
       const btn = document.createElement("button");
       btn.id = "resetBtn";
       btn.textContent = "ホームに戻る"; 
       btn.style.cssText = "padding:10px 20px; font-size:16px; margin-top:10px; background-color:#d32f2f; color:white; border:none; cursor:pointer;";
       btn.onclick = () => {
           if(confirm("ホーム画面に戻りますか？")) {
               localStorage.removeItem('current_shogi_room');
               window.location.href = "index.html"; 
           }
       };
       statusDiv.appendChild(document.createElement("br"));
       statusDiv.appendChild(btn);
    }
  } else {
    // 進行中のステータス表示
    if (!isSkillTargeting) {
      let msg = "現在の手番：" + (turn === "black" ? "先手" : "後手") + " / 手数：" + moveCount;
      if (window.isCaptureRestricted) msg += " 【攻撃禁止中】";
      
      let roleText = "";
      if (myRole === "black") roleText = "（あなた：先手）";
      else if (myRole === "white") roleText = "（あなた：後手）";
      else if (myRole === "spectator") roleText = "（観戦中）";
      msg += " " + roleText;
      msg += (isKingInCheck(turn) ? "　王手！" : "");
      statusDiv.textContent = msg;
    }
    checkStatusDiv.textContent = "";
  }

  // 盤面描画
  board.innerHTML = "";
  for (let y = 0; y < 9; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < 9; x++) {
      const td = document.createElement("td");
      const piece = boardState[y][x];
      
      if (piece) {
        const isWhite = piece === piece.toLowerCase();
        const key = piece.startsWith("+") ? "+" + piece.replace("+","").toUpperCase() : piece.toUpperCase();

        // ★ハイブリッド方式：駒コンテナ作成
        const container = document.createElement("div");
        container.className = "piece-container";
        if (isWhite) {
            container.classList.add("gote");
        }
        const baseType = piece.replace("+", "").toUpperCase();
        container.classList.add("size-" + baseType);
        const textSpan = document.createElement("span");
        textSpan.className = "piece-text";
        if (key.startsWith("+")) textSpan.classList.add("promoted");
        
        // 1文字表示
        const name = pieceName[key];
        textSpan.textContent = name.length > 1 ? name[name.length - 1] : name;

        // 色演出
        if (pieceStyles[y][x] === "green") {
          textSpan.style.color = "#32CD32";
          textSpan.style.fontWeight = "bold";
          textSpan.style.textShadow = "1px 1px 0px #000";
        }

        container.appendChild(textSpan);
        td.appendChild(container);

        // 後手の駒は反転
        if (isWhite) td.style.transform = "rotate(180deg)";
        
        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) td.classList.add("moved");
      }
      // ★★★ ここを追加（移動元を赤くする） ★★★
      if (lastMoveFrom && lastMoveFrom.x === x && lastMoveFrom.y === y) {
          td.classList.add("move-from");
      }
      if (selected && !selected.fromHand && selected.x === x && selected.y === y) td.classList.add("selected");
      if (legalMoves.some(m => m.x === x && m.y === y)) td.classList.add("move");
      
      td.onclick = () => onCellClick(x, y);
      tr.appendChild(td);
    }
    board.appendChild(tr);
  }
  renderHands();

  // 手番の強調表示
  const blackBox = document.getElementById("blackHandBox");
  const whiteBox = document.getElementById("whiteHandBox");
  if (blackBox) blackBox.classList.remove("active");
  if (whiteBox) whiteBox.classList.remove("active");

  if (!gameOver) {
    if (turn === "black" && blackBox) blackBox.classList.add("active");
    else if (turn === "white" && whiteBox) whiteBox.classList.add("active");
  }
  updateSkillButton();
}

// --- 修正版 renderHands関数 (Online Hybrid Version) ---
// script/main_online_player.js の renderHands 関数

function renderHands() {
  const order = ["P", "L", "N", "S", "G", "B", "R"];
  hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  blackHandDiv.innerHTML = "";
  whiteHandDiv.innerHTML = "";

  const createHandPiece = (player, p, i) => {
      const container = document.createElement("div");
      container.className = "hand-piece-container";
      
      // 背景や文字色のクラス付与
      if (player === "white") {
          container.classList.add("gote");
      }
      
      const textSpan = document.createElement("span");
      textSpan.className = "piece-text";
      textSpan.textContent = pieceName[p];
      
      container.appendChild(textSpan);

      // 選択状態の強調
      if (selected && selected.fromHand && selected.player === player && selected.index === i) {
          container.classList.add("selected");
      }
      
      // クリックイベント
      container.onclick = () => selectFromHand(player, i);

      // ▼▼▼ 修正箇所：視点に合わせて回転を制御 ▼▼▼
      
      // 基本ルール：観戦者または先手なら「後手の駒」を回す。
      // 　　　　　　自分が後手なら「先手の駒（＝相手）」を回す。
      
      let shouldRotate = false;

      if (myRole === "white") {
          // 【自分が後手の場合】
          // 相手（先手/black）の駒を180度回転させる
          if (player === "black") shouldRotate = true;
      } else {
          // 【自分が先手、または観戦者の場合】
          // 相手（後手/white）の駒を180度回転させる
          if (player === "white") shouldRotate = true;
      }

      if (shouldRotate) {
          container.style.transform = "rotate(180deg)";
      }
      
      // ▲▲▲ 修正ここまで ▲▲▲

      return container;
  };

  hands.black.forEach((p, i) => {
      blackHandDiv.appendChild(createHandPiece("black", p, i));
  });

  hands.white.forEach((p, i) => {
      whiteHandDiv.appendChild(createHandPiece("white", p, i));
  });
}

// script/main_online_player.js

function onCellClick(x, y) {
  if (!isGameStarted) return; 
  if (gameOver) return;
  if (myRole && turn !== myRole) return;

  // ---------------------------------------------------------
  // 1. 必殺技のターゲット選択モードの場合
  // ---------------------------------------------------------
  if (isSkillTargeting) {
    // クリックした場所が有効なターゲット（光っている場所）か確認
    if (legalMoves.some(m => m.x === x && m.y === y)) {
      
      // ★★★★★ TimeWarp（時戻し）などのシステム介入型スキルの分岐 ★★★★★
      if (currentSkill && currentSkill.isSystemAction) {
          
          console.log("システムスキル発動:", currentSkill.name);

          // 1. ターゲットモード解除
          isSkillTargeting = false;
          legalMoves = [];
          selected = null;
          const boardTable = document.getElementById("board");
          if (boardTable) boardTable.classList.remove("skill-targeting-mode");

          // 2. ローカルで「待った」を実行（自分の画面を戻す）
          undoMove();

          // 3. 使用回数の加算
          // 手番が戻っているので、「現在のturn」＝「スキルを使った人」です
          if (turn === "black") p1SkillCount++; else p2SkillCount++;
          
          // 4. ボタン状態の更新
          syncGlobalSkillState();

          // 5. 【重要】ネットワーク同期処理
          // 相手に「スキルを使ったよ」という演出を送る
          if (socket) {
              socket.emit('skill activate', { 
                  x: 0, y: 0, // 演出用のダミー座標
                  turn: turn, 
                  isFinished: true 
              });

              // 「戻した後の状態」を定義
              const newState = {
                  boardState: boardState,
                  hands: hands,
                  turn: turn,
                  moveCount: moveCount,
                  kifu: kifu,
                  p1SkillCount: p1SkillCount,
                  p2SkillCount: p2SkillCount,
                  blackCharId: sessionStorage.getItem('online_black_char'),
                  whiteCharId: sessionStorage.getItem('online_white_char')
              };

              // サーバーに「この状態に強制変更して！」と送る
              // isTimeWarp フラグを付けて、相手が普通の移動と区別できるようにする
              socket.emit('shogi move', { 
                  gameState: newState,
                  isTimeWarp: true,     // ★これが相手の画面を戻す合図
                  sel: {x:0, y:0},      
                  x:0, y:0, promote:false
              });
          }

          render();
          statusDiv.textContent = "必殺技発動！ 時を戻しました。";
          return; // ★ここで処理を終了させる（下のexecuteに行かせない）
      }
      // ★★★★★ ここまで ★★★★★


      // --- 通常のスキル（熱血など）の処理 ---
      const result = currentSkill.execute(x, y);

      if (socket) {
          socket.emit('skill activate', {
              x: x, y: y, turn: turn,
              isFinished: (result !== null) 
          });
      }

      if (result === null) {
          legalMoves = currentSkill.getValidTargets();
          render();
          statusDiv.textContent = "移動させる場所を選んでください";
          return; 
      }
      processSkillAfterEffect(currentSkill, result, turn);
    }
    return;
  }
  
  // ---------------------------------------------------------
  // 2. 通常の駒移動処理（変更なし）
  // ---------------------------------------------------------
  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;
    const isWhite = piece === piece.toLowerCase();
    if (turn === "black" && isWhite) return; 
    if (turn === "white" && !isWhite) return;
    selected = { x, y, fromHand: false };
    legalMoves = getLegalMoves(x, y);
    if (window.isCaptureRestricted) legalMoves = legalMoves.filter(m => boardState[m.y][m.x] === "");
    render();
    return;
  }
  const sel = selected;
  if (legalMoves.some(m => m.x === x && m.y === y)) {
    movePieceWithSelected(sel, x, y);
  }
  selected = null;
  legalMoves = [];
  render();
}

function selectFromHand(player, index) {
  if (!isGameStarted) return; 
  if (gameOver) return;
  if (myRole && turn !== myRole) return;
  if (turn !== player) return;
  selected = { fromHand: true, player, index };
  legalMoves = getLegalDrops(player, hands[player][index]);
  render();
}

function movePieceWithSelected(sel, x, y) {
  if (sel.fromHand) {
    executeMove(sel, x, y, false);
    return;
  }
  const piece = boardState[sel.y][sel.x];
  const isWhite = piece === piece.toLowerCase();
  const player = isWhite ? "white" : "black";
  const isPromoted = piece.includes("+");
  const base = piece.replace("+","").toUpperCase();

  if (!isPromoted && canPromote(base) && 
      (isInPromotionZone(sel.y, player) || isInPromotionZone(y, player))) {
    
    const mustPromote =
      (base === "P" || base === "L") && (y === (player === "black" ? 0 : 8)) ||
      (base === "N") && (y === (player === "black" ? 0 : 8) || y === (player === "black" ? 1 : 7));

    if (mustPromote) {
      executeMove(sel, x, y, true);
    } else {
      pendingMove = { sel, x, y }; 
      const modal = document.getElementById("promoteModal");
      if (modal) {
          modal.style.display = "flex";
      } else {
          if(confirm("成りますか？")) executeMove(sel, x, y, true);
          else executeMove(sel, x, y, false);
      }
    }
  } else {
    executeMove(sel, x, y, false);
  }
}

function executeMove(sel, x, y, doPromote, fromNetwork = false) {
  // 1. 履歴の保存
  history.push(deepCopyState());
  
  // 移動元を記録（ハイライト用）
  if (sel.fromHand) {
      lastMoveFrom = null; 
  } else {
      lastMoveFrom = { x: sel.x, y: sel.y }; 
  }

  const pieceBefore = sel.fromHand ? hands[sel.player][sel.index] : boardState[sel.y][sel.x];
  const boardBefore = boardState.map(r => r.slice());
  const moveNumber = kifu.length + 1; 

  // 2. 音の再生
  if (moveSound) {
    moveSound.currentTime = 0;
    moveSound.play().catch(() => {});
  }

  // ★★★ 修正ポイント：ここで送信していた処理を削除し、一番下に移動しました ★★★

  // 3. 盤面の更新処理（駒を動かす）
  if (sel.fromHand) {
    const piece = hands[sel.player][sel.index];
    boardState[y][x] = sel.player === "black" ? piece : piece.toLowerCase();
    hands[sel.player].splice(sel.index, 1);
    pieceStyles[y][x] = null;
  } else {
    let piece = boardState[sel.y][sel.x];
    const target = boardState[y][x];
    if (target) hands[turn].push(target.replace("+","").toUpperCase());
    const isWhite = piece === piece.toLowerCase();
    const player = isWhite ? "white" : "black";
    const base = piece.replace("+","").toUpperCase();

    if (doPromote) {
      piece = promote(piece.toUpperCase());
      if (player === "white") piece = piece.toLowerCase();
      sel.promoted = true;
      if (promoteSound) {
        promoteSound.currentTime = 0;
        promoteSound.play().catch(() => {});
      }
      const boardTable = document.getElementById("board");
      if (boardTable) {
        boardTable.classList.remove("flash-green", "flash-orange");
        void boardTable.offsetWidth;
        if (base === "R") boardTable.classList.add("flash-green");
        else if (base === "B") boardTable.classList.add("flash-orange");
        setTimeout(() => { if(boardTable) boardTable.className = ""; }, 2000);
      }
    } else {
      if (!piece.includes("+") && canPromote(base) && 
         (isInPromotionZone(sel.y, player) || isInPromotionZone(y, player))) {
         sel.unpromoted = true;
      }
    }
    boardState[sel.y][sel.x] = "";
    boardState[y][x] = piece;
    pieceStyles[y][x] = pieceStyles[sel.y][sel.x];
    pieceStyles[sel.y][sel.x] = null;
  }

  // 4. 棋譜の更新
  const currentMoveStr = formatMove(sel, x, y, pieceBefore, boardBefore, moveNumber);
  const currentMoveContent = currentMoveStr.split("：")[1] || currentMoveStr;
  kifu.push(""); 
  if (typeof lastSkillKifu !== 'undefined' && lastSkillKifu !== "") {
      kifu[kifu.length - 1] = `${moveNumber}手目：${lastSkillKifu}★，${currentMoveContent}`;
      lastSkillKifu = ""; 
  } else {
      kifu[kifu.length - 1] = currentMoveStr;
  }

  // 5. 変数の更新（手番の交代など）
  lastMoveTo = { x, y };
  turn = turn === "black" ? "white" : "black";
  window.isCaptureRestricted = false;
  
  if (typeof syncGlobalSkillState === "function") syncGlobalSkillState();
  if (typeof showKifu === "function") showKifu();
  render(); 

  if (!gameOver) startTimer();
  else stopTimer();
  
  moveCount++; // 手数を増やす

  // ★★★ 修正ポイント：移動処理が終わって「最新の状態」になってからサーバーに送る ★★★
  if (!fromNetwork) {
    const newState = {
        boardState: boardState,   // ★更新後の盤面
        hands: hands,             // ★更新後の持ち駒
        turn: turn,               // ★交代後の手番
        moveCount: moveCount,     // ★更新後の手数
        kifu: kifu,               // ★更新後の棋譜
        p1SkillCount: p1SkillCount,
        p2SkillCount: p2SkillCount,
        blackCharId: sessionStorage.getItem('online_black_char'),
        whiteCharId: sessionStorage.getItem('online_white_char')
    };

    // 相手には指し手を、サーバーには最新状態(gameState)を送る
    socket.emit('shogi move', { 
        sel: sel, 
        x: x, 
        y: y, 
        promote: doPromote,
        gameState: newState 
    });
  }

  // 6. 終了判定
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    statusDiv.textContent = "500手に達したため、引き分けです。";
    
    // ★追加：サーバーに終了を報告
    if(socket) socket.emit('game over'); 

    render();
    return;
  }

  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";
    if (myRole === "black" || myRole === "white") {
        const result = (winner === myRole) ? "win" : "lose";
        saveGameResult(result);
    }
    if(socket) socket.emit('game over');
    render();
    return;
  }
  
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();
  if (positionHistory[key] >= 4) {
    gameOver = true;
    const records = repetitionHistory[key].slice(-4);
    if (records[0].checkingSide !== null) {
      winner = records[0].checkingSide === "black" ? "white" : "black";
      statusDiv.textContent = "連続王手の千日手。王手をかけた側の負けです。";
    } else {
      winner = null;
      statusDiv.textContent = "千日手です。引き分け。";
    }
    if(socket) socket.emit('game over');
    render();
  }
}

function processSkillAfterEffect(skillObj, result, playerColor) {
  history.push(deepCopyState());
  const boardTable = document.getElementById("board");
  if (boardTable) boardTable.classList.remove("skill-targeting-mode");

  const endsTurn = (skillObj.endsTurn !== false);
  if (endsTurn) {
      kifu.push(""); kifu[kifu.length - 1] = result;
      moveCount++; 
      if (playerColor === "black") p1SkillCount++; else p2SkillCount++;
      turn = (turn === "black" ? "white" : "black");
  } else {
      const movePart = result.split("：")[1] || result;
      lastSkillKifu = movePart; 
      if (playerColor === "black") p1SkillCount++; else p2SkillCount++;
  }
  
  lastMoveTo = null;
  if (moveSound) { moveSound.currentTime = 0; moveSound.play().catch(() => {}); }
  if (skillObj.reset) skillObj.reset();
  isSkillTargeting = false;
  legalMoves = [];
  selected = null;
  syncGlobalSkillState();
  render();
  if (typeof showKifu === "function") showKifu();
  startTimer();
}

// --- 修正：投了ボタンを押したときの処理 ---
function resignGame() {
    if (gameOver) return;
    if (myRole === "spectator") return; // 観戦者は投了不可
    
    // 今までの confirm(...) をやめて、自作ポップアップを表示
    const modal = document.getElementById("resignModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

// --- 追加：ポップアップで「投了する」を選んだときの処理 ---
function executeResign() {
    closeResignModal(); // まず箱を閉じる

    // 1. サーバーに「自分が負けた」と伝える
    if (socket) {
        socket.emit('game resign', { loser: myRole });
    }

    // 2. 自分の画面の処理を行う（自分が負けたので、勝者は相手）
    const winColor = (myRole === "black") ? "white" : "black";
    resolveResignation(winColor);
}

// --- 追加：ポップアップを閉じる処理 ---
function closeResignModal() {
    const modal = document.getElementById("resignModal");
    if (modal) {
        modal.style.display = "none";
    }
}

function resolvePromotion(doPromote) {
  const modal = document.getElementById("promoteModal");
  if (modal) modal.style.display = "none";
  if (pendingMove) {
    executeMove(pendingMove.sel, pendingMove.x, pendingMove.y, doPromote);
    pendingMove = null;
  }
}

function resetGame() {
  hasShownEndEffect = false; 
  turn = "black";
  gameOver = false;
  winner = null;
  moveCount = 0;
  kifu = [];
  history = []; 
  lastMoveFrom = null;
  p1SkillCount = 0;
  p2SkillCount = 0;
  window.skillUsed = false;
  lastSkillKifu = "";
  
  boardState = [
    ["l", "n", "s", "g", "k", "g", "s", "n", "l"], // 小文字（後手）を上に
    ["", "r", "", "", "", "", "", "b", ""],
    ["p", "p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P", "P"], // 大文字（先手）を下に
    ["", "B", "", "", "", "", "", "R", ""],
    ["L", "N", "S", "G", "K", "G", "S", "N", "L"]
  ];
  
  pieceStyles = Array(9).fill(null).map(() => Array(9).fill(null));
  hands = { black: [], white: [] };
  
  if (p1Skill && p1Skill.reset) p1Skill.reset();
  if (p2Skill && p2Skill.reset) p2Skill.reset();
  syncGlobalSkillState();

  statusDiv.textContent = "対局開始！";
  checkStatusDiv.textContent = "";
  
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.remove();

  render();
  startTimer();
  if (typeof showKifu === "function") showKifu();
  playBGM();
}

// resolveResignation 関数を修正

function resolveResignation(winnerColor, reason) {
    gameOver = true;
    stopTimer();
    winner = winnerColor;
    
    const winnerName = (winner === "black") ? "先手" : "後手";
    
    if (reason === "disconnect") {
        endReason = "通信切れにより、" + winnerName + "の勝ちです。";
    } else if (reason === "timeout") {
        endReason = "時間切れにより、" + winnerName + "の勝ちです。";
    } else {
        endReason = "投了により、" + winnerName + "の勝ちです。";
    }
    
    if (typeof showKifu === "function") showKifu();
    if (myRole === "black" || myRole === "white") {
        const result = (winner === myRole) ? "win" : "lose";
        saveGameResult(result);
    }
    render();
}



function playGameEndEffect(winnerColor) {
    const cutInImg = document.getElementById("skillCutIn");
    let imgPath, audioPath;

    const iAmWinner = (winnerColor === myRole) || (myRole === "spectator" && winnerColor === "black");
    
    if (winnerColor === myRole) {
        imgPath = "script/image/shori.PNG";
        audioPath = "script/audio/shori.mp3";
    } else {
        imgPath = "script/image/haiboku.PNG";
        audioPath = "script/audio/haiboku.mp3";
    }

    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play().catch(e => {});

    if (cutInImg) {
        cutInImg.src = imgPath;
        cutInImg.classList.remove("cut-in-active");
        void cutInImg.offsetWidth; 
        cutInImg.classList.add("cut-in-active");
        setTimeout(() => { cutInImg.classList.remove("cut-in-active"); }, 3000);
    }
}


// --- 棋譜表示・コピー機能 ---

// 棋譜エリアの表示/非表示を切り替えるボタンの処理
// --- 棋譜表示の制御（ポップアップ化） ---
function toggleKifu() {
    const area = document.getElementById("kifuArea");
    if (area.style.display === "none") {
        area.style.display = "flex"; // 中央揃え
        const scrollBox = document.getElementById("kifu");
        if (scrollBox) {
            setTimeout(() => { scrollBox.scrollTop = scrollBox.scrollHeight; }, 50);
        }
    } else {
        area.style.display = "none";
    }
}

// --- 音量設定の制御 ---
function toggleVolume() {
    const modal = document.getElementById("volumeModal");
    if (modal) modal.style.display = "flex";
}

function updateVolume() {
    const bgm = document.getElementById("bgm");
    const range = document.getElementById("bgmRange");
    if (bgm && range) {
        bgm.volume = range.value;
        bgm.muted = false;
    }
}

function closeVolumeModal() {
    document.getElementById("volumeModal").style.display = "none";
}

// --- ルール確認の制御 ---
function showRules() {
    const modal = document.getElementById("rulesModal");
    if (modal) modal.style.display = "flex";
}

function closeRulesModal() {
    document.getElementById("rulesModal").style.display = "none";
}

// --- メニュー開閉（既に存在する場合は上書き） ---
function toggleMenu() {
    const panel = document.getElementById('menuPanel');
    if (panel) panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
}

// 棋譜をクリップボードにコピーする機能
function copyKifuText() {
    const kifuDiv = document.getElementById("kifu");
    if (kifuDiv) {
        navigator.clipboard.writeText(kifuDiv.innerText).then(() => {
            alert("棋譜をコピーしました！");
        }).catch(err => {
            console.error("コピーに失敗しました", err);
        });
    }
}

// 待った機能（TimeWarpから呼ばれる）
function undoMove() {
  // 履歴が足りないときは何もしない
  if (!history || history.length < 2) {
      console.log("履歴不足でundoできません");
      return;
  }
  
  // 2つ前の状態（自分の前の手番）を取り出す
  const prev = history[history.length - 2];
  history.length -= 2; 
  lastMoveFrom = null;
  
  // 状態を復元
  restoreState(prev);

  window.isCaptureRestricted = false;
  gameOver = false;
  winner = null;
  
  // 表示更新
  syncGlobalSkillState();
  render();
  if (typeof showKifu === "function") showKifu();
  startTimer();
}

// 状態復元関数（undoMoveから呼ばれる）
function restoreState(state) {
    boardState = JSON.parse(JSON.stringify(state.boardState));
    hands = JSON.parse(JSON.stringify(state.hands));
    turn = state.turn;
    moveCount = state.moveCount;
    kifu = JSON.parse(JSON.stringify(state.kifu));
    
    // スキルカウントの復元
    if (state.p1SkillCount !== undefined) p1SkillCount = state.p1SkillCount;
    if (state.p2SkillCount !== undefined) p2SkillCount = state.p2SkillCount;
    
    // エフェクト消去
    pieceStyles = Array(9).fill(null).map(() => Array(9).fill(null));
}

/**
 * オンライン対戦の結果をFirestoreに保存する関数
 * @param {string} resultStatus - "win" または "lose"
 */
function saveGameResult(resultStatus) {
    const user = auth.currentUser;
    if (!user) {
        console.log("未ログインのため、オンライン対戦の記録は保存されません。");
        return; 
    }

    const opponentDisplayName = "オンライン対戦"; 
    const isWin = (resultStatus === "win");
    
    const gameRecord = {
        date: new Date(), 
        opponent: opponentDisplayName,
        moves: moveCount,
        result: isWin ? "WIN" : "LOSE",
        mode: "online",  
        kifuData: kifu // グローバルの棋譜配列
    };

    // Firestoreのユーザーデータを更新
    db.collection("users").doc(user.uid).update({
        win: firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
        lose: firebase.firestore.FieldValue.increment(isWin ? 0 : 1),
        history: firebase.firestore.FieldValue.arrayUnion(gameRecord)
    }).then(() => {
        console.log("オンライン対戦の記録（棋譜含む）を保存しました");
    }).catch((error) => {
        console.error("オンライン対戦の保存失敗:", error);
    });
}

// ★★★ 追加：DOM操作で駒台の左右を入れ替える関数 ★★★
function updateHandLayout(role) {
    // HTML内の左右のコンテナを取得
    const leftSide = document.querySelector(".side.left");
    const rightSide = document.querySelector(".side.right");
    
    // 駒台の要素を取得
    const blackBox = document.getElementById("blackHandBox");
    const whiteBox = document.getElementById("whiteHandBox");

    // 要素が見つからなければ何もしない（エラー回避）
    if (!leftSide || !rightSide || !blackBox || !whiteBox) return;

    if (role === "white") {
        // 【自分が後手の場合】
        // 通常は「左に後手台、右に先手台」だが、
        // 自分が下側に来るので「自分の台（後手）を右、相手の台（先手）を左」にしたい。

        // 1. 黒い箱（相手）を左サイドへ移動（prependで先頭＝上側に追加）
        leftSide.prepend(blackBox);

        // 2. 白い箱（自分）を右サイドへ移動（appendChildで末尾＝下側に追加）
        // ※右サイドには投了ボタンが上にあるため、その下に追加される
        rightSide.appendChild(whiteBox);

    } else {
        // 【自分が先手 または 観戦者の場合（デフォルト）】
        // 通常通りの配置に戻す

        // 1. 白い箱（相手）を左サイドへ（先頭）
        leftSide.prepend(whiteBox);

        // 2. 黒い箱（自分）を右サイドへ（末尾）
        rightSide.appendChild(blackBox);
    }
}

// ===============================================
// ★★★ 以下、チャット機能用に追加するコード ★★★
// ===============================================

// プレイヤー名の取得（localStorageに保存されている名前を使う）
//const myPlayerName = localStorage.getItem('shogi_username') || "ゲスト";

// 1. チャット受信のリスナー設定
socket.on('chat message', (data) => {
    addMessageToChatHistory(data);
});

// 2. チャット画面の開閉切り替え
function toggleChat() {
    const body = document.getElementById("chatBody");
    if (body.style.display === "none") {
        body.style.display = "flex";
    } else {
        body.style.display = "none";
    }
}

// 3. メッセージ送信処理
function sendChatMessage() {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    // ★★★ 修正：送信する瞬間に、最新の名前を取得する！ ★★★
    const currentName = localStorage.getItem('shogi_username') || "ゲスト";

    // サーバーへ送信
    socket.emit('chat message', {
        name: currentName, // ★ここを修正
        text: text,
        role: myRole // black, white, spectator
    });

    input.value = ""; // 入力欄クリア
}

// 4. チャット履歴への追加表示
function addMessageToChatHistory(data) {
    const historyDiv = document.getElementById("chatHistory");
    if (!historyDiv) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-msg";

    if (data.isSystem) {
        // システムメッセージ
        msgDiv.className += " chat-system";
        msgDiv.textContent = data.text;
    } else {
        // 通常メッセージ
        const nameSpan = document.createElement("span");
        nameSpan.className = "chat-name";
        nameSpan.textContent = data.name + ":";
        
        // 名前色分け（先手=黒、後手=グレー、観戦者=緑）
        if (data.role === "black") nameSpan.style.color = "#000000"; 
        else if (data.role === "white") nameSpan.style.color = "#666666";
        else nameSpan.style.color = "#28a745";

        const textSpan = document.createElement("span");
        textSpan.className = "chat-text";
        textSpan.textContent = " " + data.text; 

        msgDiv.appendChild(nameSpan);
        msgDiv.appendChild(textSpan);
    }

    historyDiv.appendChild(msgDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight; // 自動スクロール
}

// 5. Enterキーで送信できるようにする（初期化後に動作）
document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("chatInput");
    if (chatInput) {
        chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendChatMessage();
        });
    }
});

// ★★★ Firebaseのログイン状態を監視して、名前を同期する処理 ★★★
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // ログインしている場合
            // 表示名(displayName)がなければメールアドレスの前半を使うなどの予備処理
            const displayName = user.displayName || (user.email ? user.email.split('@')[0] : "名無し");
            
            // LocalStorageに保存（これで次回から自動的に名前が使われる）
            localStorage.setItem('shogi_username', displayName);
            
            console.log("ログイン確認: " + displayName + " として保存しました。");

            // もし画面上に名前を表示する要素があれば更新する
            // (ロビー画面など用)
            const nameDisplay = document.getElementById('myCharName'); // ロビーのID
            if (nameDisplay && nameDisplay.textContent === "---") {
                 // ロビーの場合はキャラ名が表示されるので、
                 // 必要であればここで "ようこそ 〇〇さん" のように書き換える処理を入れる
            }
            
        } else {
            // ログインしていない場合
            console.log("未ログインです。");
        }
    });
}

// script/main_online_player.js の一番下に追加してください

// ★★★ 追加：現在のゲーム状態を丸ごとコピーして返す関数 ★★★
// これがないと、履歴（history）に正しいデータが保存されず、待った機能でエラーになります。
function deepCopyState() {
    return {
        boardState: JSON.parse(JSON.stringify(boardState)), // 盤面のコピー
        hands: JSON.parse(JSON.stringify(hands)),           // 持ち駒のコピー
        turn: turn,                                         // 手番
        moveCount: moveCount,                               // 手数
        kifu: JSON.parse(JSON.stringify(kifu)),             // 棋譜
        
        // スキルの使用状況も保存
        p1SkillCount: p1SkillCount,
        p2SkillCount: p2SkillCount,
        
        // 最後に動かした位置（ハイライト用）
        lastMoveTo: lastMoveTo ? { ...lastMoveTo } : null,
        lastMoveFrom: lastMoveFrom ? { ...lastMoveFrom } : null
    };
}

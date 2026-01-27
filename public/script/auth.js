// script/auth.js
// Firebaseの機能を使いやすくするためのファイル

// --- 1. Firebaseの設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyCUjxd4L8mnnBw6RRvvimbMZ_V1BaRZxQw",
  authDomain: "shioya-shogi.firebaseapp.com",
  projectId: "shioya-shogi",
  storageBucket: "shioya-shogi.firebasestorage.app",
  messagingSenderId: "400460108408",
  appId: "1:400460108408:web:0d43db04b02cce5230538d",
  measurementId: "G-K9ZLW8L09J"
};

// Firebaseを初期化（使える状態にする）
firebase.initializeApp(firebaseConfig);

// 認証機能を使う準備
const auth = firebase.auth();

// ★★★ 追加：データベース機能を使う準備 ★★★
const db = firebase.firestore();

// --- 2. ログイン状態を監視する（ページを開いたときに自動でチェック） ---
auth.onAuthStateChanged((user) => {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const userInfo = document.getElementById("userInfo");
    const userNameDisplay = document.getElementById("userNameDisplay");

    if (user) {
        // ■ ログインしているとき
        console.log("ログイン中:", user.email);
        
        // ボタンの表示切り替え
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-block";
        
        // ユーザー名（メールアドレス）を表示
        if (userInfo) userInfo.style.display = "block";
        if (userNameDisplay) userNameDisplay.textContent = user.email;

        // 次回以降のために、ユーザーIDを保存しておく（戦績保存などで使う）
        sessionStorage.setItem('firebase_uid', user.uid);

    } else {
        // ■ ログインしていないとき
        console.log("ログアウト状態");

        // ボタンの表示切り替え
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (userInfo) userInfo.style.display = "none";
        
        sessionStorage.removeItem('firebase_uid');
    }
});

// --- 3. 新規登録の処理 ---
function registerUser() {
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPass").value;

    if (!email || !pass) {
        alert("メールアドレスとパスワードを入力してください。");
        return;
    }

    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            // 成功したとき
            alert("登録しました！自動的にログインします。");
            closeAuthModal();
        })
        .catch((error) => {
            // 失敗したとき
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                alert("そのメールアドレスは既に登録されています。");
            } else if (error.code === 'auth/weak-password') {
                alert("パスワードは6文字以上にしてください。");
            } else {
                alert("登録エラー: " + error.message);
            }
        });
}

// --- 4. ログインの処理 ---
function loginUser() {
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPass").value;

    if (!email || !pass) {
        alert("メールアドレスとパスワードを入力してください。");
        return;
    }

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            // 成功したとき
            alert("ログインしました！");
            closeAuthModal();
        })
        .catch((error) => {
            // 失敗したとき
            console.error(error);
            alert("ログインに失敗しました。\nメールアドレスかパスワードが間違っています。");
        });
}

// --- 5. ログアウトの処理 ---
function logoutUser() {
    if(!confirm("ログアウトしますか？")) return;
    
    auth.signOut().then(() => {
        alert("ログアウトしました。");
    }).catch((error) => {
        console.error(error);
    });
}

// --- 6. モーダルウィンドウの表示・非表示 ---
function showAuthModal() {
    document.getElementById("authModal").style.display = "flex";
}

function closeAuthModal() {
    document.getElementById("authModal").style.display = "none";
}


// --- ★★★ 追加：戦績を保存する機能 ★★★ ---
function saveGameResult(result, opponentName, mode) {
    const user = auth.currentUser;
    
    if (user) {
        // ログインしている場合、データベースに保存
        // "users" というコレクションの中の "自分のID" の中の "history" にデータを足す
        db.collection("users").doc(user.uid).collection("history").add({
            result: result,       // "win" か "lose"
            opponent: opponentName, // "しおや" とか "オンラインの誰か"
            mode: mode,           // "cpu" とか "online"
            date: new Date()      // 今の日時
        })
        .then(() => {
            console.log("戦績を保存しました！");
        })
        .catch((error) => {
            console.error("保存失敗:", error);
        });

    } else {
        console.log("ログインしていないため、戦績は保存されません。");
    }
}

// --- ★★★ 追加：戦績データを取得して表示する機能 ★★★ ---
function showMyStats() {
    const user = auth.currentUser;
    if (!user) return;

    // データベースから自分の履歴をすべて取得
    db.collection("users").doc(user.uid).collection("history")
      .orderBy("date", "desc") // 新しい順に並べる
      .limit(50) // 最近の50戦分だけ（読み込みすぎ防止）
      .get()
      .then((querySnapshot) => {
          let win = 0;
          let lose = 0;
          let historyHtml = "";

          querySnapshot.forEach((doc) => {
              const data = doc.data();
              // 勝敗をカウント
              if (data.result === "win") win++;
              if (data.result === "lose") lose++;

              // 日付をきれいに変換
              const dateObj = data.date.toDate();
              const dateStr = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
              
              // 履歴リストのHTMLを作成
              const resultColor = (data.result === "win") ? "red" : "blue";
              const resultText = (data.result === "win") ? "勝ち" : "負け";
              historyHtml += `<li style="border-bottom:1px solid #ccc; padding:5px;">
                  <span style="font-size:12px; color:#666;">${dateStr}</span><br>
                  <b style="color:${resultColor}">${resultText}</b> vs ${data.opponent} (${data.mode})
              </li>`;
          });

          // 画面に表示
          document.getElementById("statsWin").textContent = win;
          document.getElementById("statsLose").textContent = lose;
          document.getElementById("statsHistory").innerHTML = historyHtml;
          
          // モーダルを開く
          document.getElementById("statsModal").style.display = "flex";
      })
      .catch((error) => {
          console.error("データの取得に失敗:", error);
          alert("戦績の読み込みに失敗しました。");
      });
}

function closeStatsModal() {
    document.getElementById("statsModal").style.display = "none";
}
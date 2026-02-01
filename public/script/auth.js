// script/auth.js

// ★★★ あなたのFirebase設定 ★★★
const firebaseConfig = {
  apiKey: "AIzaSyCUjxd4L8mnnBw6RRvvimbMZ_V1BaRZxQw",
  authDomain: "shioya-shogi.firebaseapp.com",
  projectId: "shioya-shogi",
  storageBucket: "shioya-shogi.firebasestorage.app",
  messagingSenderId: "400460108408",
  appId: "1:400460108408:web:0d43db04b02cce5230538d",
  measurementId: "G-K9ZLW8L09J"
};

// 初期化（二重初期化防止チェック付き）
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
// グローバル変数として使えるようにする
const db = firebase.firestore();
const auth = firebase.auth();

// ----------------------
// ユーザー状態監視（全ページ共通）
// ----------------------
auth.onAuthStateChanged(async (user) => {
    // 画面上の要素を取得（存在しないページもあるのでチェック用）
    const nameDisplay = document.getElementById("userNameDisplay");
    const editBtn = document.getElementById("editNameBtn");

    if (user) {
        // 1. 表示名の決定
        let displayName = user.displayName;
        if (!displayName) {
            try {
                const doc = await db.collection("users").doc(user.uid).get();
                if (doc.exists && doc.data().name) displayName = doc.data().name;
            } catch(e) { console.error(e); }
        }
        if (!displayName) displayName = user.email.split("@")[0];

        // ★★★ 追加：ここでLocalStorageに保存！（これで全ページの名前問題が解決） ★★★
        localStorage.setItem('shogi_username', displayName);
        console.log("ログイン中: " + displayName);

        // 2. 画面表示の更新（要素がある場合のみ）
        if (nameDisplay) nameDisplay.textContent = displayName;
        if (editBtn) editBtn.style.display = "inline-block";

        // ロビー画面などで名前表示枠がある場合の対応
        const lobbyName = document.getElementById("myCharName");
        if (lobbyName && lobbyName.textContent === "---") {
             // 必要ならここにロビー特有の表示更新処理を書けます
        }

        // 3. 戦績データの読み込み（関数がある場合のみ）
        if (typeof loadUserStats === "function") loadUserStats(user.uid);

    } else {
        // 未ログイン時
        localStorage.setItem('shogi_username', "ゲスト"); // ゲストに戻す
        
        if (nameDisplay) nameDisplay.textContent = "ゲスト";
        if (editBtn) editBtn.style.display = "none";
        if (document.getElementById("statsWin")) document.getElementById("statsWin").textContent = "0";
        if (document.getElementById("statsLose")) document.getElementById("statsLose").textContent = "0";
    }
});

// ----------------------
// 戦績・棋譜表示機能
// ----------------------
function loadUserStats(userId) {
    db.collection("users").doc(userId).onSnapshot((doc) => {
        if (!doc.exists) return;

        const data = doc.data();
        const win = data.win || 0;
        const lose = data.lose || 0;
        const history = data.history || [];

        if (document.getElementById("statsWin")) document.getElementById("statsWin").textContent = win;
        if (document.getElementById("statsLose")) document.getElementById("statsLose").textContent = lose;

        if (typeof window.updateKifuDisplay === "function") {
            window.updateKifuDisplay(history);
        }

        const historyList = document.getElementById("statsHistory");
        if (historyList) {
            historyList.innerHTML = "";
            [...history].reverse().slice(0, 10).forEach(h => {
                const li = document.createElement("li");
                li.style.padding = "8px";
                li.style.borderBottom = "1px solid #eee";
                li.style.fontSize = "0.9rem";
                li.style.color = (h.result === "WIN") ? "#d32f2f" : "#1976d2";
                li.textContent = `[${h.result === "WIN" ? '勝' : '負'}] vs ${h.opponent || "不明"}`;
                historyList.appendChild(li);
            });
        }
    });
}

// ----------------------
// 棋譜詳細モーダル
// ----------------------
function showKifuDetails(kifuArray, opponent) {
    const modal = document.getElementById("kifuDetailsModal");
    const textDiv = document.getElementById("modalKifuText");
    const title = document.getElementById("modalTitle");

    if (!modal || !textDiv) return;

    if (title) title.textContent = "対局記録 vs " + (opponent || "CPU");
    textDiv.textContent = Array.isArray(kifuArray) ? kifuArray.join("\n") : kifuArray;
    modal.style.display = "flex";
}

function closeKifuModal() {
    const modal = document.getElementById("kifuDetailsModal");
    if (modal) modal.style.display = "none";
}

// ----------------------
// モーダル・ログイン・名前変更
// ----------------------
function showAuthModal() {
    const modal = document.getElementById("authModal");
    const user = auth.currentUser;
    const inputs = document.getElementById("authInputs");
    const logoutBtn = document.getElementById("logoutBtnInModal");
    const title = document.getElementById("authTitle");

    if (modal) {
        modal.style.display = "flex";
        if (user) {
            if (inputs) inputs.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "block";
            if (title) title.textContent = `${user.displayName || "ユーザー"} さんの設定`;
        } else {
            if (inputs) inputs.style.display = "block";
            if (logoutBtn) logoutBtn.style.display = "none";
            if (title) title.textContent = "ログイン / 新規登録";
        }
    }
}

function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.style.display = "none";
}

function registerUser() {
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPass").value;
    const nameInput = document.getElementById("authName") ? document.getElementById("authName").value : "";

    if (!email || !pass) { alert("メールとパスワードを入力してください"); return; }
    auth.createUserWithEmailAndPassword(email, pass).then((cred) => {
        const user = cred.user;
        const displayName = nameInput || "名無し棋士";
        user.updateProfile({ displayName: displayName }).then(() => {
            return db.collection("users").doc(user.uid).set({
                name: displayName, email: email, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                win: 0, lose: 0, history: []
            });
        }).then(() => { alert("登録しました！"); location.reload(); });
    }).catch((error) => { alert("登録失敗: " + error.message); });
}

function loginUser() {
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPass").value;
    if (!email || !pass) { alert("メールとパスワードを入力してください"); return; }
    auth.signInWithEmailAndPassword(email, pass).then(() => {
        alert("ログインしました！");
        closeAuthModal();
        if (!document.getElementById("userNameDisplay")) window.location.href = "home.html";
    }).catch((error) => { alert("ログイン失敗"); });
}

function logoutUser() {
    if(!confirm("ログアウトしますか？")) return;
    auth.signOut().then(() => { location.reload(); });
}

function showNameEditModal() {
    const user = auth.currentUser;
    if (!user) return;
    document.getElementById("newNameInput").value = document.getElementById("userNameDisplay").textContent;
    document.getElementById("nameEditModal").style.display = "flex";
}

function closeNameEditModal() { document.getElementById("nameEditModal").style.display = "none"; }

function saveNewName() {
    const user = auth.currentUser;
    const newName = document.getElementById("newNameInput").value;
    if (!newName) return;
    user.updateProfile({ displayName: newName }).then(() => {
        return db.collection("users").doc(user.uid).set({ name: newName }, { merge: true });
    }).then(() => {
        document.getElementById("userNameDisplay").textContent = newName;
        // LocalStorageも更新
        localStorage.setItem('shogi_username', newName);
        closeNameEditModal();
    });
}

function showMyStats() {
    if (!auth.currentUser) { alert("ログインしていません"); showAuthModal(); return; }
    document.getElementById("statsModal").style.display = "flex";
}
function closeStatsModal() { document.getElementById("statsModal").style.display = "none"; }

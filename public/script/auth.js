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

// 初期化
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// ----------------------
// ユーザー状態監視
// ----------------------
// script/auth.js 内の該当箇所をチェック

auth.onAuthStateChanged(async (user) => {
    const nameDisplay = document.getElementById("userNameDisplay");
    const editBtn = document.getElementById("editNameBtn"); // ✏️ボタン

    if (user) {
        // 【ログイン中】
        let displayName = user.displayName;
        if (!displayName) {
            try {
                const doc = await db.collection("users").doc(user.uid).get();
                if (doc.exists && doc.data().name) displayName = doc.data().name;
            } catch(e) { console.error(e); }
        }
        if (!displayName) displayName = user.email.split("@")[0];

        if (nameDisplay) nameDisplay.textContent = displayName;
        
        // ★重要：ログイン中だけ「名前変更ボタン」を表示する
        if (editBtn) editBtn.style.display = "inline-block";

        if (typeof loadUserStats === "function") loadUserStats(user.uid);

    } else {
        // 【未ログイン（ゲスト）】
        console.log("未ログイン：ゲストモード");
        
        // ★重要：名前をゲストに固定し、変更ボタンを完全に隠す
        if (nameDisplay) nameDisplay.textContent = "ゲスト";
        if (editBtn) editBtn.style.display = "none";
        
        // 戦績などもリセット
        if (document.getElementById("statsWin")) document.getElementById("statsWin").textContent = "0";
        if (document.getElementById("statsLose")) document.getElementById("statsLose").textContent = "0";
    }
});

// ----------------------
// 基本機能（モーダル・ログイン等）
// ----------------------

// ★★★ 修正：ログイン状態に応じて表示を切り替える ★★★
function showAuthModal() {
    const modal = document.getElementById("authModal");
    const user = auth.currentUser;
    const inputs = document.getElementById("authInputs");
    const logoutBtn = document.getElementById("logoutBtnInModal");
    const title = document.getElementById("authTitle");

    if (modal) {
        modal.style.display = "flex";

        if (user) {
            // ■ ログイン中の場合
            // 入力欄を隠す
            if (inputs) inputs.style.display = "none";
            // ログアウトボタンを出す
            if (logoutBtn) logoutBtn.style.display = "block";
            // タイトルを変える
            if (title) title.textContent = `${user.displayName || "ユーザー"} さんの設定`;
        } else {
            // ■ 未ログインの場合
            // 入力欄を出す
            if (inputs) inputs.style.display = "block";
            // ログアウトボタンを隠す
            if (logoutBtn) logoutBtn.style.display = "none";
            // タイトルを戻す
            if (title) title.textContent = "ログイン / 新規登録";
        }
    }
}

function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.style.display = "none";
}

// 新規登録
function registerUser() {
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPass").value;
    const nameInput = document.getElementById("authName") ? document.getElementById("authName").value : "";

    if (!email || !pass) { alert("メールとパスワードを入力してください"); return; }
    if (pass.length < 6) { alert("パスワードは6文字以上で設定してください"); return; }

    auth.createUserWithEmailAndPassword(email, pass)
        .then((cred) => {
            const user = cred.user;
            const displayName = nameInput || "名無し棋士";

            user.updateProfile({ displayName: displayName }).then(() => {
                return db.collection("users").doc(user.uid).set({
                    name: displayName,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    win: 0, lose: 0, history: []
                });
            }).then(() => {
                alert("登録しました！");
                closeAuthModal();
                location.reload(); 
            });
        })
        .catch((error) => { alert("登録失敗: " + error.message); });
}

// ログイン
function loginUser() {
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPass").value;

    if (!email || !pass) { alert("メールとパスワードを入力してください"); return; }

    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            alert("ログインしました！");
            closeAuthModal();
            if (!document.getElementById("userNameDisplay")) window.location.href = "home.html";
        })
        .catch((error) => { alert("ログイン失敗: IDかパスワードが違います"); });
}

// ログアウト
function logoutUser() {
    if(!confirm("ログアウトしますか？")) return;
    auth.signOut().then(() => {
        alert("ログアウトしました");
        location.reload();
    });
}

// ----------------------
// 名前変更機能
// ----------------------

function showNameEditModal() {
    const user = auth.currentUser;
    if (!user) return;

    const currentName = document.getElementById("userNameDisplay").textContent;
    document.getElementById("newNameInput").value = currentName;
    document.getElementById("nameEditModal").style.display = "flex";
}

function closeNameEditModal() {
    document.getElementById("nameEditModal").style.display = "none";
}

function saveNewName() {
    const user = auth.currentUser;
    if (!user) return;

    const newName = document.getElementById("newNameInput").value;
    if (!newName) {
        alert("名前を入力してください");
        return;
    }

    user.updateProfile({
        displayName: newName
    }).then(() => {
        return db.collection("users").doc(user.uid).set({
            name: newName
        }, { merge: true });
    }).then(() => {
        document.getElementById("userNameDisplay").textContent = newName;
        closeNameEditModal();
    }).catch((error) => {
        console.error("名前変更エラー", error);
        alert("変更に失敗しました: " + error.message);
    });
}


// ----------------------
// 戦績機能
// ----------------------
function loadUserStats(userId) {
    if (!document.getElementById("statsWin")) return;

    db.collection("users").doc(userId).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (document.getElementById("statsWin")) document.getElementById("statsWin").textContent = data.win || 0;
            if (document.getElementById("statsLose")) document.getElementById("statsLose").textContent = data.lose || 0;

            const historyList = document.getElementById("statsHistory");
            if (historyList) {
                historyList.innerHTML = "";
                if (data.history && data.history.length > 0) {
                    const reversed = [...data.history].reverse();
                    reversed.forEach(h => {
                        const li = document.createElement("li");
                        let dateStr = "";
                        if (h.date && h.date.toDate) {
                            const d = h.date.toDate();
                            dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
                        }
                        li.textContent = `[${h.result}] vs ${h.opponent || "不明"} (${dateStr})`;
                        li.style.borderBottom = "1px solid #eee";
                        li.style.padding = "5px";
                        li.style.color = (h.result === "WIN") ? "red" : "blue";
                        historyList.appendChild(li);
                    });
                } else {
                    historyList.innerHTML = "<li>対局履歴はありません</li>";
                }
            }
        }
    });
}

function showMyStats() {
    const user = auth.currentUser;
    if (!user) {
        alert("ログインしていません。");
        showAuthModal();
        return;
    }
    const modal = document.getElementById("statsModal");
    if (modal) modal.style.display = "flex";
}
function closeStatsModal() {
    const modal = document.getElementById("statsModal");
    if (modal) modal.style.display = "none";
}

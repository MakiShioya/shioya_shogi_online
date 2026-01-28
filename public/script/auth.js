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
auth.onAuthStateChanged(async (user) => {
    const nameDisplay = document.getElementById("userNameDisplay");
    const editBtn = document.getElementById("editNameBtn");

    if (user) {
        let displayName = user.displayName;
        if (!displayName) {
            try {
                const doc = await db.collection("users").doc(user.uid).get();
                if (doc.exists && doc.data().name) displayName = doc.data().name;
            } catch(e) { console.error(e); }
        }
        if (!displayName) displayName = user.email.split("@")[0];

        if (nameDisplay) nameDisplay.textContent = displayName;
        if (editBtn) editBtn.style.display = "inline-block";

        if (typeof loadUserStats === "function") loadUserStats(user.uid);

    } else {
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

        // --- 1. ホーム画面用(statsModal)の更新 ---
        if (document.getElementById("statsWin")) document.getElementById("statsWin").textContent = win;
        if (document.getElementById("statsLose")) document.getElementById("statsLose").textContent = lose;

        // --- 2. 棋譜ページ(mypage.html)専用の更新 ---
        const winDisplay = document.getElementById("displayWin");
        if (winDisplay) {
            winDisplay.textContent = win;
            document.getElementById("displayLose").textContent = lose;
            const total = win + lose;
            const rate = total > 0 ? Math.round((win / total) * 100) : 0;
            document.getElementById("displayRate").textContent = rate;

            const kifuContainer = document.getElementById("fullKifuList");
            kifuContainer.innerHTML = ""; 

            if (history.length === 0) {
                kifuContainer.innerHTML = '<div style="text-align:center; padding:20px;">まだ対局データがありません</div>';
            } else {
                [...history].reverse().forEach((h, index) => {
                    const item = document.createElement("div");
                    item.className = "kifu-item";

                    let dateStr = "不明な日付";
                    if (h.date && h.date.toDate) {
                        const d = h.date.toDate();
                        dateStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
                    }

                    const resultClass = (h.result === "WIN") ? "result-win" : "result-lose";
                    const resultText = (h.result === "WIN") ? "勝ち" : "負け";

                    // ★棋譜データがあるかチェックしてボタンを生成
                    const hasKifu = h.kifuData && h.kifuData.length > 0;
                    
                    item.innerHTML = `
                        <div class="kifu-info">
                            <div class="kifu-date">${dateStr}</div>
                            <div class="kifu-opponent">相手：${h.opponent || "CPU"}</div>
                            <div style="color: #666;">${h.moves || "?"}手で${resultText}</div>
                        </div>
                        <div style="text-align: right;">
                            <div class="${resultClass}">${resultText}</div>
                            ${hasKifu ? `<button class="view-kifu-btn" data-index="${index}" style="margin-top:5px; padding:3px 8px; font-size:0.75rem; cursor:pointer; background:#8b4513; color:white; border:none; border-radius:3px;">棋譜を見る</button>` : ''}
                        </div>
                    `;

                    // ボタンにクリックイベントを設定
                    if (hasKifu) {
                        const btn = item.querySelector(".view-kifu-btn");
                        btn.onclick = () => showKifuDetails(h.kifuData, h.opponent);
                    }

                    kifuContainer.appendChild(item);
                });
            }
        }

        // --- 3. ホーム画面の簡易リスト更新 ---
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

// ★追加：棋譜詳細をモーダルで表示する
function showKifuDetails(kifuArray, opponent) {
    const modal = document.getElementById("kifuDetailsModal");
    const textDiv = document.getElementById("modalKifuText");
    const title = document.getElementById("modalTitle");

    if (!modal || !textDiv) return;

    if (title) title.textContent = "対局記録 vs " + (opponent || "CPU");
    
    // 配列を改行で結合して表示
    textDiv.textContent = kifuArray.join("\n");
    
    modal.style.display = "flex";
}

// ★追加：詳細モーダルを閉じる
function closeKifuModal() {
    const modal = document.getElementById("kifuDetailsModal");
    if (modal) modal.style.display = "none";
}

// ----------------------
// モーダル・ログイン・名前変更（既存機能）
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
        closeNameEditModal();
    });
}

function showMyStats() {
    if (!auth.currentUser) { alert("ログインしていません"); showAuthModal(); return; }
    document.getElementById("statsModal").style.display = "flex";
}
function closeStatsModal() { document.getElementById("statsModal").style.display = "none"; }

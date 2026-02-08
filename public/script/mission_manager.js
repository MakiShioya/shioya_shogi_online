// script/mission_manager.js

// Firestoreの user.missions = { "mission_id": { progress: 0, collected: false } } という構造を想定

// 進捗を更新する関数
async function updateMissionProgress(actionType, incrementAmount = 1) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const userRef = db.collection("users").doc(user.uid);
  
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      if (!doc.exists) return;

      const userData = doc.data();
      const currentMissions = userData.missions || {};
      let updated = false;

      // 定義済みミッションの中から、該当するタイプを探す
      // ※ GAME_MISSIONS が定義されている前提
      if (typeof GAME_MISSIONS !== 'undefined') {
          GAME_MISSIONS.forEach(mission => {
            if (mission.type === actionType) {
              const mData = currentMissions[mission.id] || { progress: 0, collected: false };
              
              // まだ報酬を受け取っておらず、目標未達の場合のみ更新
              if (!mData.collected && mData.progress < mission.target) {
                mData.progress += incrementAmount;
                
                // 上限キャップ
                if (mData.progress > mission.target) mData.progress = mission.target;

                currentMissions[mission.id] = mData;
                updated = true;

                // 達成通知
                if (mData.progress >= mission.target) {
                  console.log(`ミッション達成！: ${mission.title}`);
                }
              }
            }
          });
      }

      if (updated) {
        transaction.update(userRef, { missions: currentMissions });
      }
    });
    // console.log(`Mission progress updated: type=${actionType}`);
  } catch (e) {
    console.error("Mission update error:", e);
  }
}

// 報酬を受け取る関数
// script/mission_manager.js

// ... (前半の updateMissionProgress はそのまま) ...

// 報酬を受け取る関数（修正版：メールボックスへ送信）
async function claimMissionReward(missionId) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  // 定義ファイルからミッション情報を取得
  const missionDef = GAME_MISSIONS.find(m => m.id === missionId);
  if (!missionDef) return;

  const userRef = db.collection("users").doc(user.uid);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      if (!doc.exists) throw "User not found";

      const userData = doc.data();
      const userMissions = userData.missions || {};
      const mData = userMissions[missionId];

      // バリデーション：データ存在、目標達成済み、未受け取り
      if (!mData || mData.progress < missionDef.target || mData.collected) {
        throw "Cannot claim reward";
      }

      // 1. ミッション自体の「受取済」フラグを立てる
      // (これでミッション画面では「受取済」になり、ボタンが押せなくなります)
      mData.collected = true;
      userMissions[missionId] = mData;
      
      // 2. メールボックスに新しいメールを追加する
      const rewardName = (missionDef.rewardType === 'gold') 
                         ? `${missionDef.rewardValue} G` 
                         : (missionDef.rewardName || "アイテム");

      const newMail = {
          id: `mail_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // ユニークID
          subject: `ミッション達成：${missionDef.title}`,
          body: `ミッション「${missionDef.title}」を達成しました！\n報酬を受け取ってください。\n\n内容：${missionDef.desc}`,
          date: new Date(), // Firestore Timestampとして保存される
          reward: {
              type: missionDef.rewardType,
              value: missionDef.rewardValue,
              name: rewardName
          }
      };

      // 既存のメールボックス配列に追加（なければ作成）
      const currentMailbox = userData.mailbox || [];
      const updatedMailbox = [...currentMailbox, newMail];

      // 更新実行
      transaction.update(userRef, { 
          missions: userMissions,
          mailbox: updatedMailbox
      });
    });
    
    // 成功メッセージ
    alert("報酬がメールボックスに届きました！\nホーム画面のメールから受け取ってください。");

  } catch (e) {
    console.error("Claim error:", e);
    alert("処理に失敗しました。");
  }
}

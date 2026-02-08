// script/mission_manager.js

// Firestoreの user.missions = { "mission_id": { progress: 0, collected: false } } という構造を想定

// 進捗を更新する関数（対局終了時などに呼ぶ）
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

            // 達成通知（簡易的なログ）
            if (mData.progress >= mission.target) {
              console.log(`ミッション達成！: ${mission.title}`);
              // ここでトースト通知などを出しても良い
            }
          }
        }
      });

      if (updated) {
        transaction.update(userRef, { missions: currentMissions });
      }
    });
    console.log(`Mission progress updated: type=${actionType}`);
  } catch (e) {
    console.error("Mission update error:", e);
  }
}

// 報酬を受け取る関数
async function claimMissionReward(missionId) {
  const user = firebase.auth().currentUser;
  if (!user) return;

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

      // チェック：データ存在、目標達成済み、未受け取り
      if (!mData || mData.progress < missionDef.target || mData.collected) {
        throw "Cannot claim reward";
      }

      // 1. 受け取り済みフラグを立てる
      mData.collected = true;
      userMissions[missionId] = mData;
      
      const updates = { missions: userMissions };

      // 2. 報酬の付与
      if (missionDef.rewardType === "gold") {
        updates.gold = (userData.gold || 0) + missionDef.rewardValue;
      } else if (missionDef.rewardType === "item") {
        const currentInv = userData.inventory || [];
        if (!currentInv.includes(missionDef.rewardValue)) {
          updates.inventory = firebase.firestore.FieldValue.arrayUnion(missionDef.rewardValue);
        }
      }

      transaction.update(userRef, updates);
    });
    
    alert(`報酬を受け取りました！\n${missionDef.rewardType === 'gold' ? missionDef.rewardValue + ' G' : missionDef.rewardName}`);
    // 画面再描画（mission.htmlで定義する関数を呼ぶ）
    if (typeof renderMissions === "function") renderMissions();

  } catch (e) {
    console.error("Claim error:", e);
    alert("報酬の受け取りに失敗しました。");
  }
}
const CpuDoubleAction = {
  name: "神速（２回行動）",
  
  // コスト設定（非常に強力なので重くする）
  baseCost: 300,
  costGrowth: 200,

  // コスト計算（CPUの使用回数に基づく）
  getCost: function() {
    // main.js で定義する cpuSkillUseCount を参照
    const count = (typeof window.cpuSkillUseCount !== 'undefined') ? window.cpuSkillUseCount : 0;
    return this.baseCost + (count * this.costGrowth);
  }
};
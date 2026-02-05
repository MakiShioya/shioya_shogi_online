// script/data/a.js

if (typeof window.CHARACTERS === "undefined") { window.CHARACTERS = {}; }

window.CHARACTERS['a'] = {
    name: 'キャラB',
    image: 'script/image/a_touka.png',
    base: [
        "Bで！\nk今日も頑張ります！",
        "将棋ですか！\nお供します！",
        "相手が強いほど燃えますね！",
        "もっと骨のあるヤツはいませんかね！",
        "どしどし意見ください！",
        "なんですか！{name}さん"
    ],
    time: {
        morning: ["今日も一日頑張りましょう！{name}さん！"],
        noon: ["お昼ですね！{name}さん！"],
        evening: ["暗くなってきましたね！{name}さん！"],
        night: ["黙りますね。"]
    }

};


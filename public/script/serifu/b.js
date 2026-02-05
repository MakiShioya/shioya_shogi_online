// script/data/b.js

if (typeof window.CHARACTERS === "undefined") { window.CHARACTERS = {}; }

window.CHARACTERS['b'] = {
    name: 'キャラC',
    image: 'script/image/b_touka.png',
    base: [
        "Bです。\nよろしくお願いします。",
        "気分転換に\n散歩に出かけましょ。",
        "今日は忙しいです。",
        "何か飲みますか。",
        "対局ですか",
        "なんですか{name}さん"
    ],
    time: {
        morning: ["おはようございます{name}さん。"],
        noon: ["こんにちは{name}さん。"],
        evening: ["こんばんは{name}さん。"],
        night: ["静かですね"]
    }

};

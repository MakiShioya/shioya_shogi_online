// script/data/b.js

if (typeof window.CHARACTERS === "undefined") { window.CHARACTERS = {}; }

window.CHARACTERS['b'] = {
    name: 'キャラC',
    image: 'script/image/b_touka.png',
    base: [
        "Cです。\nよろしくお願いします。",
        "少し雰囲気が違いますか？\nふふっ。",
        "{name}さんの手筋、\n勉強させていただきます。"
    ],
    time: {
        morning: ["おはようございます。\n{name}さん。"],
        noon: ["こんにちは。"],
        evening: ["こんばんは。"],
        night: ["静かですね…"]
    }
};
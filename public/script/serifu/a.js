// script/data/a.js

if (typeof window.CHARACTERS === "undefined") { window.CHARACTERS = {}; }

window.CHARACTERS['a'] = {
    name: 'キャラB',
    image: 'script/image/a_touka.png',
    base: [
        "Bです。\nよろしくお願いします。",
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
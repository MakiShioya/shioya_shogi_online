// script/data/d.js

if (typeof window.CHARACTERS === "undefined") { window.CHARACTERS = {}; }

window.CHARACTERS['d'] = {
    name: 'キャラD',
    image: 'script/image/d_touka.png',
    base: [
        "Dです。\nよろしくお願いします。",
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
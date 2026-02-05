// script/data/b.js

if (typeof window.CHARACTERS === "undefined") { window.CHARACTERS = {}; }

window.CHARACTERS['b'] = {
    name: 'キャラC',
    image: 'script/image/b_touka.png',
    base: [
        "C。\nよろしく",
        "気分転換に\n散歩に出かけてくるよ",
        "今日は忙しいよ",
        "何か飲む？",
        "対局する？",
        "対局だよ",
        "急がないで",
        "つかれた",
        "何か用？",
        "待って\n今考えてるから",
        "準備はいい？",
        "なに？{name}さん"
    ],
    time: {
        morning: ["おはよ\n{name}さん"],
        noon: ["昼もう食べた？"],
        evening: ["こんばんは"],
        night: ["静かだね",
               "寝たら？"]
    }

};




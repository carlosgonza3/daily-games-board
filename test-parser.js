const { parseResults } = require('./parser.js');
const assert = require('assert');

const whatsapp = `[10/21, 4:44 PM] Juanpa Meza: Wordle 1,950 4/6

⬛⬛⬛⬛🟨
🟩⬛⬛🟨⬛
🟩⬛🟩⬛⬛
🟩🟩🟩🟩🟩
[10/21, 4:44 PM] Juanpa Meza: Perceptle #96 - D (40)
🔢 3  🎯 4  📐 28  🥁 68  ✂️ 95
https://perceptle.com
[10/21, 4:45 PM] Juanpa Meza: Krillion #98 🦐
200

⬛🦑🫧🦑🦑⬛🫧
[10/21, 4:45 PM] Juanpa Meza: www.maptap.gg October 21
80👏 74😂 100🎯 68🤨 80🤗
Final score: 798
[10/21, 4:45 PM] Juanpa Meza: Size It Up
Overall Score 251

⬜⬜⬜⬜⬜ 0
🟥🟥🟥🟥⬜ 72
🟥🟥🟥🟥🟥 97
🟥🟥🟥🟥⬜ 82
⬜⬜⬜⬜⬜ 0
https://magnitudle.com/size-it-up`;

const all = parseResults(whatsapp);
console.log(JSON.stringify(all, null, 1));
assert.strictEqual(all.length, 5, 'five games from the whatsapp dump');

const byGame = Object.fromEntries(all.map(r => [r.game, r]));
assert.strictEqual(byGame.wordle.score, 4);
assert.strictEqual(byGame.wordle.puzzle, 1950);
assert.strictEqual(byGame.wordle.display, '4/6');
assert.strictEqual(byGame.wordle.grid.split('\n').length, 4);

assert.strictEqual(byGame.perceptle.score, 40);
assert.strictEqual(byGame.perceptle.display, 'D (40)');
assert.deepStrictEqual(byGame.perceptle.rounds.map(r => r.value), [3, 4, 28, 68, 95]);
assert.deepStrictEqual(byGame.perceptle.rounds.map(r => r.label), ['🔢', '🎯', '📐', '🥁', '✂️']);

assert.strictEqual(byGame.krillion.score, 200);
assert.strictEqual(byGame.krillion.puzzle, 98);
assert.strictEqual(byGame.krillion.grid, '⬛🦑🫧🦑🦑⬛🫧');

assert.strictEqual(byGame.maptap.score, 798);
assert.deepStrictEqual(byGame.maptap.rounds.map(r => r.value), [80, 74, 100, 68, 80]);
assert.deepStrictEqual(byGame.maptap.rounds.map(r => r.label), ['1', '2', '3', '4', '5']);

assert.strictEqual(byGame.sizeitup.score, 251);
assert.deepStrictEqual(byGame.sizeitup.rounds.map(r => r.value), [0, 72, 97, 82, 0]);
assert.strictEqual(byGame.sizeitup.rounds[1].bar, '🟥🟥🟥🟥⬜');

// Single pastes straight from each game, no WhatsApp wrapper
assert.strictEqual(parseResults('Wordle 1,951 X/6*\n\n⬛⬛⬛⬛⬛\n🟨⬛⬛⬛⬛\n🟨🟩⬛⬛⬛\n🟩🟩⬛⬛⬛\n🟩🟩🟩⬛⬛\n🟩🟩🟩🟩⬛')[0].score, 7);
assert.strictEqual(parseResults('Wordle 1,951 X/6*\n\n⬛⬛⬛⬛⬛')[0].display, 'X/6*');
assert.strictEqual(parseResults('Krillion #99 🦐\n140')[0].score, 140);
assert.strictEqual(parseResults('Krillion #99 🦐\n140')[0].grid, null);
assert.strictEqual(parseResults('www.maptap.gg October 22\n100🎯 55😂 61👏 90🤗 72🤨\nFinal score: 812')[0].score, 812);
assert.deepStrictEqual(parseResults('www.maptap.gg October 22\n100🎯 55😂 61👏 90🤗 72🤨\nFinal score: 812')[0].rounds.map(r => r.value), [100, 55, 61, 90, 72]);
// same reaction emoji twice must still give five separate rounds
assert.deepStrictEqual(parseResults('www.maptap.gg October 22\n80👏 80👏 100🎯 68🤨 80👏\nFinal score: 408')[0].rounds.map(r => r.label + ':' + r.value), ['1:80', '2:80', '3:100', '4:68', '5:80']);
assert.strictEqual(parseResults('Perceptle #97 - A (91)\n🔢 90  🎯 88  📐 95  🥁 92  ✂️ 90\nhttps://perceptle.com')[0].score, 91);
// Perceptle sometimes adds an emoji after the number and uses an en or em dash (seen on iOS)
['Perceptle #98 🃏 – F (31)', 'Perceptle #98 🃏 — F (31)', 'Perceptle #98 - F (31)', 'Perceptle #98 🏆 – A+ (97)'].forEach(function (head) {
  const r = parseResults(head + '\n🔢 99  🎯 0  📐 1  🥁 27  ✂️ 26\nhttps://perceptle.com');
  assert.strictEqual(r.length, 1, 'parses: ' + head);
  assert.strictEqual(r[0].puzzle, 98);
  assert.deepStrictEqual(r[0].rounds.map(x => x.value), [99, 0, 1, 27, 26]);
});
assert.strictEqual(parseResults('Perceptle #98 🃏 – F (31)\n🔢 99  🎯 0  📐 1  🥁 27  ✂️ 26')[0].display, 'F (31)');
assert.strictEqual(parseResults('Perceptle #98 🏆 – A+ (97)\n🔢 99  🎯 0  📐 1  🥁 27  ✂️ 26')[0].display, 'A+ (97)');
assert.strictEqual(parseResults('hello there').length, 0);

// Windows line endings and trailing whitespace
assert.strictEqual(parseResults('Size It Up\r\nOverall Score 300\r\n\r\n🟥🟥🟥🟥🟥 100\r\n🟥🟥🟥🟥🟥 100 \r\n🟥🟥🟥🟥🟥 100\r\n')[0].rounds.length, 3);

console.log('all parser tests passed');

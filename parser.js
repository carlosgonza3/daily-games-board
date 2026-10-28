// Parsers for the five daily games. Pure functions, no DOM.
// Each returns null when the text has no result for that game, otherwise:
//   { game, score, display, puzzle, rounds, grid }
//   score   number used for sorting (direction per game in GAMES)
//   display string shown in tables ("4/6", "798")
//   rounds  [{label, value}] per-round numbers, or null
//   grid    emoji block kept for games that share a picture, or null

const GAMES = {
  wordle:    { name: 'Wordle',     short: 'W', dir: 'asc',  unit: 'guesses', url: 'https://www.nytimes.com/games/wordle/index.html' },
  perceptle: { name: 'Perceptle',  short: 'P', dir: 'desc', unit: 'pts',     url: 'https://perceptle.com' },
  krillion:  { name: 'Krillion',   short: 'K', dir: 'desc', unit: 'pts',     url: 'https://krillion.io' },
  maptap:    { name: 'Maptap',     short: 'M', dir: 'desc', unit: 'pts',     url: 'https://www.maptap.gg' },
  sizeitup:  { name: 'Size It Up', short: 'S', dir: 'desc', unit: 'pts',     url: 'https://magnitudle.com/size-it-up' },
};
const GAME_ORDER = ['wordle', 'perceptle', 'krillion', 'maptap', 'sizeitup'];

const EMOJI = '(?:\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*)';

function normalize(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    // strip WhatsApp "[10/21, 4:44 PM] Name:" prefixes if someone pastes from the chat anyway
    .replace(/^\[\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,\s*[^\]]*\]\s*[^:\n]{1,60}:\s*/gm, '')
    .replace(/ /g, ' ');
}

function parseWordle(t) {
  const m = t.match(/Wordle\s+#?([\d,.]+)\s+([1-6X])\/6(\*?)[ \t]*\n+((?:[⬛⬜🟨🟩🟧🟦]{5}[ \t]*\n?)+)?/u);
  if (!m) return null;
  const guesses = m[2] === 'X' ? 7 : parseInt(m[2], 10);
  const rows = m[4] ? m[4].trim().split('\n').map(r => r.trim()).filter(Boolean) : [];
  return {
    game: 'wordle',
    puzzle: parseInt(m[1].replace(/[,.]/g, ''), 10),
    score: guesses,
    display: (m[2] === 'X' ? 'X' : m[2]) + '/6' + (m[3] ? '*' : ''),
    rounds: null,
    grid: rows.length ? rows.join('\n') : null,
  };
}

function parsePerceptle(t) {
  // Between the puzzle number and the grade there may be a decorative emoji and any kind of dash
  // ("#96 - D (40)", "#98 🃏 – F (31)"), so skip to the grade instead of matching the separator.
  const m = t.match(/Perceptle\s+#(\d+)[^\n(]*?([A-F][+-]?)\s*\((\d+)\)[ \t]*\n+([^\n]+)/u);
  if (!m) return null;
  const rounds = [];
  const re = new RegExp('(' + EMOJI + ')\\s*(\\d+)', 'gu');
  let r;
  while ((r = re.exec(m[4])) !== null) rounds.push({ label: r[1], value: parseInt(r[2], 10) });
  return {
    game: 'perceptle',
    puzzle: parseInt(m[1], 10),
    score: parseInt(m[3], 10),
    display: m[2] + ' (' + m[3] + ')',
    rounds: rounds.length ? rounds : null,
    grid: null,
  };
}

function parseKrillion(t) {
  const m = t.match(/Krillion\s+#(\d+)[^\n]*\n+\s*(\d+)[ \t]*(?:\n+([^\n]*))?/u);
  if (!m) return null;
  const row = (m[3] || '').trim();
  return {
    game: 'krillion',
    puzzle: parseInt(m[1], 10),
    score: parseInt(m[2], 10),
    display: m[2],
    rounds: null,
    grid: /\p{Extended_Pictographic}/u.test(row) ? row : null,
  };
}

function parseMaptap(t) {
  const m = t.match(/maptap\.gg\s+([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)[ \t]*\n+([^\n]+)\n+\s*Final score:\s*(\d+)/iu);
  if (!m) return null;
  // Five rounds in order. The emoji after each number is just the game's reaction to that score, not a round id.
  const rounds = [];
  const re = new RegExp('(\\d+)\\s*(?:' + EMOJI + ')?', 'gu');
  let r;
  while ((r = re.exec(m[2])) !== null) rounds.push({ label: String(rounds.length + 1), value: parseInt(r[1], 10) });
  return {
    game: 'maptap',
    puzzle: null,
    puzzleDate: m[1].trim(),
    score: parseInt(m[3], 10),
    display: m[3],
    rounds: rounds.length ? rounds : null,
    grid: null,
  };
}

function parseSizeItUp(t) {
  const m = t.match(/Size It Up[ \t]*\n+\s*Overall Score\s+(\d+)[ \t]*\n+((?:[⬜⬛🟥🟧🟨🟩🟦🟪🟫]+\s+\d+[ \t]*\n?)+)/u);
  if (!m) return null;
  const rounds = m[2].trim().split('\n').map((line, i) => {
    const mm = line.trim().match(/^([⬜⬛🟥🟧🟨🟩🟦🟪🟫]+)\s+(\d+)$/u);
    return mm ? { label: String(i + 1), value: parseInt(mm[2], 10), bar: mm[1] } : null;
  }).filter(Boolean);
  return {
    game: 'sizeitup',
    puzzle: null,
    score: parseInt(m[1], 10),
    display: m[1],
    rounds: rounds.length ? rounds : null,
    grid: null,
  };
}

const PARSERS = [parseWordle, parsePerceptle, parseKrillion, parseMaptap, parseSizeItUp];

// Parse any number of game results out of one blob of text.
function parseResults(text) {
  const t = normalize(text);
  const out = [];
  for (const p of PARSERS) {
    const r = p(t);
    if (r) out.push(r);
  }
  return out;
}

// Compare two scores for a game: negative when a beats b.
function compareScores(game, a, b) {
  return GAMES[game].dir === 'asc' ? a - b : b - a;
}

if (typeof module !== 'undefined') {
  module.exports = { GAMES, GAME_ORDER, parseResults, compareScores, normalize };
}

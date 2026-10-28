// Builds index.html from template.html + parser.js. Run: node build.js
const fs = require('fs');
const parser = fs.readFileSync('parser.js', 'utf8').replace(/if \(typeof module[\s\S]*$/, '').trim();
const tpl = fs.readFileSync('template.html', 'utf8');
if (!tpl.includes('/*__PARSER__*/')) throw new Error('placeholder missing');
const body = tpl.replace('/*__PARSER__*/', parser);

// syntax check the inline script before writing anything
const script = body.match(/<script>([\s\S]*)<\/script>/)[1];
new Function(script); // throws on a syntax error

const doc = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<meta name="theme-color" content="#101820" media="(prefers-color-scheme: dark)">'
  + '<meta name="theme-color" content="#F4F1EA" media="(prefers-color-scheme: light)">'
  + '<meta name="apple-mobile-web-app-capable" content="yes">'
  + '<meta name="apple-mobile-web-app-title" content="Games Board">'
  + '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>'
  + '</head><body>' + body + '</body></html>';
fs.writeFileSync('index.html', doc);
console.log('wrote index.html', doc.length, 'bytes');

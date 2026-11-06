// Bot Maker pack 4: text stickers (brat, attp, quotly), games, downloads
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toSticker } from '../lib/media.js'
import { run as sh, tmpFile, rm, num } from '../lib/utils.js'
import config from '../config.js'

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'media', 'fonts')
const R = n => Math.floor(Math.random() * n)
const P = a => a[R(a.length)]
const C = []
const add = (name, desc, cat, f, o = {}) => C.push({ name, alias: o.alias || [], category: cat, desc, usage: o.u || '', group: !!o.g, owner: !!o.o, async run (ctx) {
  try { const out = await f(ctx.text || '', ctx.args || [], ctx); if (out) await ctx.reply(out) } catch (e) { await ctx.reply('❌ ' + (e.message || 'galat input') + (o.u ? '\nUse: ' + ctx.prefix + name + ' ' + o.u : '')) } } })
const need = (c, m) => { if (!c) throw new Error(m || 'Kuch likho') }
const quotedText = ctx => ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ''
const ff = () => config.ffmpeg || 'ffmpeg'
const wrap = (s, n) => { const out = []; let line = ''; for (const w of s.split(/\s+/)) { if ((line + ' ' + w).trim().length > n && line) { out.push(line); line = w } else line = (line + ' ' + w).trim() } if (line) out.push(line); return out }
const clean = s => String(s).replace(/[^\x20-\x7E\n]/g, '').trim()

async function render (filter, { seconds = 0 } = {}) {
  const o = tmpFile(seconds ? 'webp' : 'png')
  const args = seconds
    ? ['-y', '-f', 'lavfi', '-i', `color=c=white@0.0:s=512x512:d=${seconds},format=rgba`, '-vf', filter, '-loop', '0', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '60', '-r', '10', o]
    : ['-y', '-f', 'lavfi', '-i', 'color=c=white:s=512x512:d=1', '-vf', filter, '-frames:v', '1', o]
  await sh(ff(), args, { timeout: 60000 })
  const b = fs.readFileSync(o); rm(o); return b
}
function textFile (lines) { const f = tmpFile('txt'); fs.writeFileSync(f, lines.join('\n')); return f }
const esc = p => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")

// brat: safed background, kala dhundla text (trend wala)
add('brat', 'Brat style text sticker', 'sticker', async (t, a, ctx) => {
  const s = clean(t || quotedText(ctx)).toLowerCase(); need(s, 'Text likho: .brat hello')
  const lines = wrap(s, 10).slice(0, 6); const tf = textFile(lines)
  const size = Math.max(50, Math.min(110, Math.floor(430 / Math.max(...lines.map(l => l.length), 1) * 1.7)))
  try {
    const png = await render(`drawtext=fontfile='${esc(FONTS + '/BebasNeue.ttf')}':textfile='${esc(tf)}':fontsize=${size}:fontcolor=black:line_spacing=6:x=(w-text_w)/2:y=(h-text_h)/2,boxblur=2:1`)
    return { sticker: await toSticker(png, { pack: 'AQDAS', author: 'brat' }) }
  } finally { rm(tf) }
}, { u: '<text>' })
// attp: rang badalta chamakta text (animated sticker)
add('attp', 'Rang badalta animated text sticker', 'sticker', async (t, a, ctx) => {
  const s = clean(t || quotedText(ctx)); need(s, 'Text likho: .attp AQDAS')
  const lines = wrap(s, 12).slice(0, 5); const tf = textFile(lines)
  const size = Math.max(40, Math.min(120, Math.floor(450 / Math.max(...lines.map(l => l.length), 1) * 1.6)))
  const dt = (c, s, e) => `drawtext=fontfile='${esc(FONTS + '/Bangers.ttf')}':textfile='${esc(tf)}':fontsize=${size}:fontcolor=${c}:borderw=4:bordercolor=black:line_spacing=8:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(mod(t,0.9),${s},${e})'`
  try {
    const webp = await render([dt('0xFF3B3B', 0, 0.3), dt('0x3BFF6B', 0.3, 0.6), dt('0x3B8BFF', 0.6, 0.9)].join(','), { seconds: 1.8 })
    return { sticker: webp }
  } finally { rm(tf) }
}, { alias: ['attp2', 'glowtext'], u: '<text>' })
// quotly: message ka quote bubble sticker
add('quotly', 'Message ka quote sticker (reply karo)', 'sticker', async (t, a, ctx) => {
  const s = clean(quotedText(ctx) || t); need(s, 'Kisi text message pe reply karo')
  const name = clean(ctx.quoted?.pushName || (ctx.quoted?.key?.participant ? '+' + num(ctx.quoted.key.participant) : ctx.pushName || 'User')) || 'User'
  const lines = wrap(s, 22).slice(0, 9); const tf = textFile(lines); const nf = textFile([name.slice(0, 24)])
  const fs1 = 30, h = Math.min(470, 90 + lines.length * (fs1 + 8))
  try {
    const png = await render(`drawbox=x=0:y=0:w=512:h=512:color=0x0B141A:t=fill,drawbox=x=16:y=(512-${h})/2:w=480:h=${h}:color=0x1F2C34:t=fill,drawtext=fontfile='${esc(FONTS + '/Righteous.ttf')}':textfile='${esc(nf)}':fontsize=28:fontcolor=0x53BDEB:x=40:y=(512-${h})/2+18,drawtext=fontfile='${esc(FONTS + '/CourierPrime.ttf')}':textfile='${esc(tf)}':fontsize=${fs1}:fontcolor=white:line_spacing=8:x=40:y=(512-${h})/2+62`)
    return { sticker: await toSticker(png, { pack: 'AQDAS', author: 'quotly' }) }
  } finally { rm(tf, nf) }
}, { alias: ['qc'] })

// ================= GAMES (per chat state) =================
const games = new Map() // jid -> { type, ... , until }
const gameOf = ctx => { const g = games.get(ctx.jid); if (g && Date.now() > g.until) { games.delete(ctx.jid); return null } return g }
const WORDS = ['pakistan', 'computer', 'biryani', 'cricket', 'mobile', 'whatsapp', 'internet', 'karachi', 'lahore', 'school', 'teacher', 'android', 'keyboard', 'monitor', 'samosa', 'football', 'painter', 'doctor', 'airport', 'chocolate', 'mountain', 'elephant', 'library', 'hospital', 'birthday']
const EMOJI = [['🍎📱', 'apple'], ['🦁👑', 'lion king'], ['🕷️🧑', 'spiderman'], ['🦇🧑', 'batman'], ['❄️👸', 'frozen'], ['🚢🧊', 'titanic'], ['🧙‍♂️💍', 'lord of the rings'], ['🐼🥋', 'kung fu panda'], ['🏏🏆', 'world cup'], ['☕🍪', 'chai biscuit'], ['🌙⭐', 'chand tara'], ['🔥🦊', 'firefox'], ['📸📷', 'instagram'], ['🐦💙', 'twitter'], ['👻💛', 'snapchat']]
const scr = w => { let s; do { s = [...w].sort(() => Math.random() - 0.5).join('') } while (s === w && w.length > 2); return s }
add('unscramble', 'Ulte akshar seedhe karo (game)', 'games', (t, a, ctx) => { const w = P(WORDS); games.set(ctx.jid, { type: 'word', ans: w, until: Date.now() + 120000 }); return `🔤 *Unscramble*\n\n*${scr(w).toUpperCase()}*\n\nJawab: .answer word (2 min)` }, { alias: ['scramble2', 'wordgame'] })
add('emojiquiz', 'Emoji se pehchano (game)', 'games', (t, a, ctx) => { const [e, ans] = P(EMOJI); games.set(ctx.jid, { type: 'emoji', ans, until: Date.now() + 120000 }); return `🤔 *Emoji Quiz*\n\n${e}\n\nJawab: .emojianswer jawab (2 min)` }, { alias: ['equiz'] })
add('guessnumber', 'Number guess game (1-100)', 'games', (t, a, ctx) => { games.set(ctx.jid, { type: 'num', ans: 1 + R(100), tries: 0, until: Date.now() + 300000 }); return '🎯 *Guess the Number*\n1 se 100 ke beech number socha hai\nJawab: .answer 50' }, { alias: ['gnum', 'numguess'] })
const answer = (t, a, ctx) => {
  const g = gameOf(ctx); if (!g) return '❌ Koi game nahi chal rahi. Shuru karo: .unscramble / .emojiquiz / .guessnumber / .tictactoe'
  const x = t.trim().toLowerCase(); need(x, 'Jawab likho')
  if (g.type === 'num') { const n = parseInt(x); g.tries++; if (n === g.ans) { games.delete(ctx.jid); return { text: `🎉 @${num(ctx.sender)} sahi! Number *${g.ans}* tha (${g.tries} tries)`, mentions: [ctx.sender] } } return n < g.ans ? '⬆️ Bara number socho' : '⬇️ Chhota number socho' }
  if (g.type === 'word' || g.type === 'emoji') { if (x.replace(/\s+/g, '') === g.ans.replace(/\s+/g, '')) { games.delete(ctx.jid); return { text: `🎉 @${num(ctx.sender)} ne sahi jawab diya: *${g.ans}*`, mentions: [ctx.sender] } } return '❌ Galat, dobara try karo' }
  return '❌ Is game ke liye ye command nahi'
}
add('answer', 'Game ka jawab', 'games', answer, { alias: ['ans'] })
add('emojianswer', 'Emoji quiz ka jawab', 'games', answer, { alias: ['eans'] })
add('giveup', 'Game chhor do, jawab dekho', 'games', (t, a, ctx) => { const g = gameOf(ctx); if (!g) return 'Koi game nahi'; games.delete(ctx.jid); return g.type === 'ttt' ? '🏳️ Tic Tac Toe khatam' : `🏳️ Jawab tha: *${g.ans}*` }, { alias: ['surrender'] })
// word chain: pichle word ke aakhri harf se naya word
add('wordchain', 'Word chain game', 'games', (t, a, ctx) => { const w = P(WORDS); games.set(ctx.jid, { type: 'chain', last: w, used: new Set([w]), until: Date.now() + 600000 }); return `🔗 *Word Chain*\nPehla word: *${w}*\nAgla word *${w.slice(-1).toUpperCase()}* se: .wc word` }, { alias: ['wchain'] })
add('wc', 'Word chain mein word do', 'games', (t, a, ctx) => { const g = gameOf(ctx); if (!g || g.type !== 'chain') return 'Pehle .wordchain shuru karo'; const w = t.trim().toLowerCase().replace(/[^a-z]/g, ''); need(w.length >= 3, '3+ harf ka English word'); if (w[0] !== g.last.slice(-1)) return `❌ Word *${g.last.slice(-1).toUpperCase()}* se shuru hona chahiye`; if (g.used.has(w)) return '❌ Ye word ho chuka'; g.used.add(w); g.last = w; g.until = Date.now() + 600000; return `✅ *${w}* (+1 @${num(ctx.sender)})\nAgla: *${w.slice(-1).toUpperCase()}* se` })
// tic tac toe (2 players)
const board = b => b.map((c, i) => c || ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'][i]).reduce((s, c, i) => s + c + (i % 3 === 2 ? '\n' : ''), '')
const win = b => [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]].find(([x, y, z]) => b[x] && b[x] === b[y] && b[y] === b[z])
add('tictactoe', 'Tic Tac Toe: .tictactoe @dost', 'games', (t, a, ctx) => { const o = ctx.mentioned?.[0] || ctx.quoted?.key?.participant; need(o && o !== ctx.sender, 'Kisi dost ko tag karo: .tictactoe @user'); const g = { type: 'ttt', b: Array(9).fill(null), p: [ctx.sender, o], turn: 0, until: Date.now() + 600000 }; games.set(ctx.jid, g); return { text: `❌⭕ *Tic Tac Toe*\n❌ @${num(g.p[0])}  vs  ⭕ @${num(g.p[1])}\n\n${board(g.b)}\nBaari: @${num(g.p[0])} → .ttt 5`, mentions: g.p } }, { alias: ['ttt2', 'xo'], u: '@user' })
add('ttt', 'Tic tac toe chaal: .ttt 1-9', 'games', (t, a, ctx) => { const g = gameOf(ctx); if (!g || g.type !== 'ttt') return 'Pehle .tictactoe @dost'; if (g.p[g.turn] !== ctx.sender) return { text: `⏳ Abhi @${num(g.p[g.turn])} ki baari hai`, mentions: [g.p[g.turn]] }; const i = parseInt(t) - 1; need(i >= 0 && i < 9 && !g.b[i], 'Khaali khana chuno (1-9)'); g.b[i] = g.turn ? '⭕' : '❌'; const w = win(g.b); if (w) { games.delete(ctx.jid); return { text: `${board(g.b)}\n🏆 @${num(ctx.sender)} jeet gaya!`, mentions: [ctx.sender] } } if (g.b.every(Boolean)) { games.delete(ctx.jid); return `${board(g.b)}\n🤝 Barabar!` } g.turn = 1 - g.turn; g.until = Date.now() + 600000; return { text: `${board(g.b)}\nBaari: @${num(g.p[g.turn])}`, mentions: [g.p[g.turn]] } }, { u: '1-9' })

// ================= DOWNLOADS =================
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
add('mediafire', 'MediaFire file download', 'download', async (t, a, ctx) => {
  const u = (t.match(/https?:\/\/(www\.)?mediafire\.com\/\S+/) || [])[0]; need(u, 'MediaFire link do')
  await ctx.react('⏳')
  const h = await (await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })).text()
  const dl = (h.match(/href="(https?:\/\/download[^"]+)"/) || [])[1]; need(dl, 'Download link nahi mila (file private/deleted?)')
  const name = decodeURIComponent(dl.split('/').pop()).slice(0, 80)
  const size = (h.match(/Download \(([\d.]+\s*[KMG]B)\)/) || [])[1] || '?'
  if (/GB/.test(size) || parseFloat(size) > 95 && /MB/.test(size)) return `📦 *${name}* (${size})\nBohot bari hai, yahan se download karo:\n${dl}`
  await ctx.reply({ document: { url: dl }, fileName: name, mimetype: 'application/octet-stream', caption: `📦 ${name} (${size})\n_— AQDAS MD_` })
  await ctx.react('✅')
}, { alias: ['mf', 'mfdl'], u: '<link>' })
add('gitclone', 'GitHub repo ZIP: .gitclone link', 'download', async (t, a, ctx) => {
  const m = /github\.com\/([\w.-]+)\/([\w.-]+)/i.exec(t) || /^([\w.-]+)\/([\w.-]+)$/.exec(t.trim()); need(m, 'GitHub repo link do')
  const repo = m[2].replace(/\.git$/, '')
  const r = await fetch(`https://api.github.com/repos/${m[1]}/${repo}`, { headers: { 'user-agent': 'AQDAS-MD' }, signal: AbortSignal.timeout(15000) }); need(r.ok, 'Repo nahi mila (private?)')
  const j = await r.json()
  await ctx.reply({ document: { url: `https://codeload.github.com/${m[1]}/${repo}/zip/refs/heads/${j.default_branch}` }, fileName: `${repo}.zip`, mimetype: 'application/zip', caption: `📦 *${j.full_name}*\n⭐ ${j.stargazers_count} | 🍴 ${j.forks_count}\n${j.description || ''}\n_— AQDAS MD_` })
}, { alias: ['gitdl', 'repodl'], u: '<github link>' })
add('wallpaper', 'HD wallpaper: .wallpaper nature', 'download', async (t, a, ctx) => {
  const q = t.trim() || 'beautiful landscape'
  await ctx.react('🖼')
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(q + ', 4k wallpaper, ultra detailed') + `?width=1080&height=1920&nologo=true&seed=${R(1e9)}`
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); need(r.ok, 'Image server busy')
  return { image: Buffer.from(await r.arrayBuffer()), caption: `🖼 *${q}*\n_— AQDAS MD_` }
}, { alias: ['wall', 'hdwall'], u: '<topic>' })
add('img2', 'AI image: .img2 cat astronaut', 'download', async (t, a, ctx) => {
  need(t.trim(), 'Kya image chahiye? .img2 red car')
  await ctx.react('🎨')
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(t.trim()) + `?width=1024&height=1024&nologo=true&seed=${R(1e9)}`
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); need(r.ok, 'Image server busy')
  return { image: Buffer.from(await r.arrayBuffer()), caption: `🎨 ${t.trim()}\n_— AQDAS MD_` }
}, { alias: ['aiimage2'], u: '<prompt>' })
add('ytsearch', 'YouTube search: .ytsearch naat', 'download', async (t, a, ctx) => {
  need(t.trim(), 'Kya dhoondna hai?')
  await ctx.react('🔎')
  const { stdout } = await sh(config.ytdlp || 'yt-dlp', ['--flat-playlist', '--no-warnings', '--print', '%(id)s\t%(title)s\t%(duration_string)s\t%(channel)s', `ytsearch8:${t.trim()}`], { timeout: 60000 })
  const rows = stdout.trim().split('\n').map(l => l.split('\t')).filter(r => r[0]?.length === 11)
  need(rows.length, 'Kuch nahi mila')
  return '🔎 *YouTube results*\n\n' + rows.map((r, i) => `${i + 1}. *${r[1]}*\n   ⏱ ${r[2] || '?'} | 👤 ${r[3] || '?'}\n   🔗 https://youtu.be/${r[0]}`).join('\n\n') + '\n\nDownload: .play naam / .ytmp4 link'
}, { alias: ['yts2', 'ytfind'], u: '<naam>' })
add('statusdl', 'Status save karo (status pe reply)', 'download', async (t, a, ctx) => {
  const q = ctx.quoted?.message; need(q, 'Kisi status pe reply karke .statusdl likho')
  const type = Object.keys(q).find(k => /image|video|audio/.test(k)); need(type, 'Is status mein photo/video nahi')
  const buf = await ctx.download()
  const cap = q[type]?.caption || ''
  if (/image/.test(type)) return { image: buf, caption: cap || '📥 Status saved' }
  if (/video/.test(type)) return { video: buf, caption: cap || '📥 Status saved' }
  return { audio: buf, mimetype: 'audio/mpeg' }
}, { alias: ['savestatus', 'ssave'] })

export default C

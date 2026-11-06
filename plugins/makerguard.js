// Protection / security / automation commands (Bot Maker)
import { jidNormalizedUser } from '@whiskeysockets/baileys'
import * as settings from '../lib/settings.js'
import { num } from '../lib/utils.js'
import { warnUser } from '../lib/guard.js'

const onoff = a => /^(on|enable|1|kick|warn|delete)$/i.test(a || '') ? true : /^(off|disable|0)$/i.test(a || '') ? false : null
const who = ctx => ctx.mentioned?.[0] || ctx.quoted?.key?.participant || (String(ctx.args[0] || '').replace(/\D/g, '').length > 9 ? ctx.args[0].replace(/\D/g, '') + '@s.whatsapp.net' : null)
const C = []
// group toggle: .antisticker on/off/warn/kick
function gtoggle (name, key, desc, { modes = false, alias = [] } = {}) {
  C.push({ name, alias, category: 'protection', group: true, admin: true, usage: modes ? 'on/warn/kick/off' : 'on/off', desc, async run (ctx) {
    const a = (ctx.args[0] || '').toLowerCase()
    const cur = settings.group(ctx.jid)[key]
    const v = onoff(a)
    if (v === null) return ctx.reply(`🛡 *${name}*: ${cur ? 'ON' + (typeof cur === 'string' ? ' (' + cur + ')' : '') : 'OFF'}\n${desc}\nUse: .${name} ${modes ? 'on / warn / kick / off' : 'on / off'}`)
    const val = v ? (modes ? (/kick|warn/.test(a) ? a : 'delete') : true) : false
    settings.setGroup(ctx.jid, key, val)
    if (v && !ctx.isBotAdmin) await ctx.reply('⚠️ Kaam karne ke liye bot ko admin banao')
    return ctx.reply(`✅ *${name}* ${v ? 'ON' + (modes ? ' (' + val + ')' : '') : 'OFF'}`)
  } })
}
gtoggle('antibot', 'antiBot', 'Dusre bots ko group se nikalo', { modes: true })
gtoggle('antiedit', 'antiEdit', 'Edit kiya message pehle wala dikhao')
gtoggle('antiflood', 'antiFlood', '10 sec mein 7+ message = spam', { modes: true, alias: ['antispam'] })
gtoggle('antisticker', 'antiSticker', 'Stickers delete', { modes: true })
gtoggle('antitag', 'antiTag', '5+ logon ko tag karna band', { modes: true, alias: ['antimention'] })
gtoggle('antistatus', 'antiStatus', 'Group status mention band', { modes: true, alias: ['antigcstatus'] })
gtoggle('lockfrwrd', 'lockFrwrd', 'Forward messages delete', { modes: true, alias: ['antiforward', 'antifwd'] })
gtoggle('antibadword', 'antiBadword', 'Gande alfaaz pe action (.badwordaction)', { alias: ['antitoxic'] })
gtoggle('antidemote', 'antiDemote', 'Admin ko koi hataye to wapas admin + hatane wale ka admin khatam')
gtoggle('antipromote', 'antiPromote', 'Koi naya admin banaye to wapas hatao')
gtoggle('lockadmin', 'lockAdmin', 'Naye admin banana band')
gtoggle('adminalert', 'adminAlert', 'Admin promote/demote hone pe alert')
gtoggle('antiadmin', 'antiPromote', 'Anti-promote ka doosra naam')

C.push({ name: 'badwordaction', category: 'security', group: true, admin: true, usage: 'delete/warn/kick', desc: 'Ganda lafz pe kya ho', async run (ctx) { const a = (ctx.args[0] || '').toLowerCase(); if (!['delete', 'warn', 'kick'].includes(a)) return ctx.reply('Use: .badwordaction delete / warn / kick'); settings.setGroup(ctx.jid, 'badwordAction', a); ctx.reply('✅ Badword action: ' + a) } })
const wl = ctx => { const gs = settings.group(ctx.jid); gs.badwords = gs.badwords || []; return gs }
C.push({ name: 'addbadword', category: 'security', group: true, admin: true, usage: '<lafz>', desc: 'Ganda lafz list mein', async run (ctx) { const w = (ctx.text || '').toLowerCase().split(/[ ,]+/).filter(Boolean); if (!w.length) return ctx.reply('Lafz likho'); const gs = wl(ctx); for (const x of w) if (!gs.badwords.includes(x)) gs.badwords.push(x); settings.save(); ctx.reply(`✅ Add: ${w.join(', ')}\n(.antibadword on karna mat bhoolna)`) } })
C.push({ name: 'delbadword', category: 'security', group: true, admin: true, usage: '<lafz>', desc: 'Lafz list se hatao', async run (ctx) { const gs = wl(ctx); const w = (ctx.text || '').toLowerCase().trim(); gs.badwords = gs.badwords.filter(x => x !== w); settings.save(); ctx.reply('✅ Hata diya: ' + w) } })
C.push({ name: 'badwords', category: 'security', group: true, desc: 'Gande alfaaz ki list', async run (ctx) { const gs = wl(ctx); ctx.reply(gs.badwords.length ? `🤬 *Badwords (${gs.badwords.length})*\n${gs.badwords.join(', ')}\nAction: ${gs.badwordAction || 'warn'} | ${gs.antiBadword ? 'ON' : 'OFF'}` : 'List khali hai. .addbadword lafz') } })
C.push({ name: 'warn', category: 'security', group: true, admin: true, usage: '@user [wajah]', desc: 'Warning do (3 pe kick)', async run (ctx) { const j = who(ctx); if (!j) return ctx.reply('Kis ko? Tag ya reply karo'); await warnUser(ctx, jidNormalizedUser(j), ctx.text.replace(/@\d+/g, '').trim() || 'admin ne warning di') } })
C.push({ name: 'warnings', alias: ['warnlist', 'checkwarn'], category: 'security', group: true, desc: 'Warnings dekho', async run (ctx) { const gs = settings.group(ctx.jid); const w = gs.warns || {}; const j = who(ctx); if (j) return ctx.reply({ text: `⚠️ @${num(j)}: ${w[jidNormalizedUser(j)] || 0}/${gs.warnMax || 3}`, mentions: [j] }); const e = Object.entries(w).filter(([, n]) => n); ctx.reply(e.length ? { text: '⚠️ *Warnings*\n' + e.map(([k, n]) => `@${num(k)}: ${n}`).join('\n'), mentions: e.map(([k]) => k) } : '✅ Kisi ko warning nahi') } })
C.push({ name: 'resetwarn', alias: ['delwarn', 'clearwarn'], category: 'security', group: true, admin: true, usage: '@user', desc: 'Warnings khatam', async run (ctx) { const gs = settings.group(ctx.jid); gs.warns = gs.warns || {}; const j = who(ctx); if (j) delete gs.warns[jidNormalizedUser(j)]; else gs.warns = {}; settings.save(); ctx.reply('✅ Warnings reset') } })
C.push({ name: 'ban', category: 'security', owner: true, usage: '@user', desc: 'User bot use na kar sake', async run (ctx) { const j = who(ctx); if (!j) return ctx.reply('Kis ko? Tag/reply/number'); const l = settings.get('banned') || []; const n = jidNormalizedUser(j); if (!l.includes(n)) l.push(n); settings.set('banned', l); ctx.reply('🚫 Ban: ' + num(n)) } })
C.push({ name: 'unban', category: 'security', owner: true, usage: '@user', desc: 'Ban khatam', async run (ctx) { const j = who(ctx); if (!j) return ctx.reply('Kis ko?'); settings.set('banned', (settings.get('banned') || []).filter(x => x !== jidNormalizedUser(j))); ctx.reply('✅ Unban: ' + num(j)) } })
C.push({ name: 'banlist', category: 'security', owner: true, desc: 'Banned users', async run (ctx) { const l = settings.get('banned') || []; ctx.reply(l.length ? '🚫 *Banned*\n' + l.map((j, i) => `${i + 1}. ${num(j)}`).join('\n') : '✅ Koi ban nahi') } })
C.push({ name: 'akick', alias: ['autokick'], category: 'protection', group: true, admin: true, usage: 'add/del/list <number>', desc: 'Ye number group mein aaye to auto kick', async run (ctx) { const gs = settings.group(ctx.jid); gs.akick = gs.akick || []; const [op, n0] = ctx.args; const n = String(n0 || '').replace(/\D/g, '').replace(/^0/, '92'); if (op === 'add' && n) { if (!gs.akick.includes(n)) gs.akick.push(n); settings.save(); return ctx.reply('✅ Auto-kick list: ' + n) } if (op === 'del' && n) { gs.akick = gs.akick.filter(x => x !== n); settings.save(); return ctx.reply('✅ Hata diya') } ctx.reply(gs.akick.length ? '🚫 *Auto-kick*\n' + gs.akick.join('\n') : 'Use: .akick add 923xxx') } })
// automation (number-level)
function stoggle (name, key, desc, alias = []) { C.push({ name, alias, category: 'automation', owner: true, usage: 'on/off', desc, async run (ctx) { const v = onoff(ctx.args[0]); if (v === null) return ctx.reply(`⚙️ *${name}*: ${settings.get(key) ? 'ON' : 'OFF'}\n${desc}`); settings.set(key, v); ctx.reply(`✅ *${name}* ${v ? 'ON' : 'OFF'}`) } }) }
stoggle('anticall', 'antiCall', 'Call aaye to khud reject + message', ['rejectcall', 'nocall'])
stoggle('mentionreply', 'mentionReply', 'Koi tag kare to auto jawab', ['tagreply'])
C.push({ name: 'setmentionreply', alias: ['setmention'], category: 'automation', owner: true, usage: '<text>', desc: 'Tag pe jawab ka text', async run (ctx) { if (!ctx.text) return ctx.reply('Text likho'); settings.set('mentionText', ctx.text); settings.set('mentionAudio', null); ctx.reply('✅ Mention reply text set') } })
C.push({ name: 'setmentionaudio', alias: ['setmsong', 'mentionreplysong'], category: 'automation', owner: true, usage: '<mp3 link> ya audio pe reply', desc: 'Tag pe audio/song', async run (ctx) {
  let url = (ctx.text || '').trim()
  if (!/^https?:\/\//.test(url) && /audio/i.test(ctx.targetType || '')) { const b = await ctx.download(); if (b.length > 800 * 1024) return ctx.reply('Audio 800KB se chhota ho (ya mp3 ka link do)'); url = 'b64:' + b.toString('base64') }
  if (!/^(https?:\/\/|b64:)/.test(url)) return ctx.reply('MP3 link do ya audio pe reply karo')
  settings.set('mentionAudio', url); settings.set('mentionReply', true); ctx.reply('✅ Mention audio set + mentionreply ON')
} })
C.push({ name: 'resetmentionaudio', alias: ['delmentionaudio'], category: 'automation', owner: true, desc: 'Mention audio hatao', async run (ctx) { settings.set('mentionAudio', null); ctx.reply('✅ Mention audio hata diya (text reply rahega)') } })
export default C

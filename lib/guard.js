// Group protection + automation (Bot Maker): antibot, antiedit, antiflood, antisticker, antitag, antistatus,
// lockfrwrd, badwords, ban, warn, mentionreply, antidemote/antipromote/adminalert/lockadmin/akick, anticall
import { jidNormalizedUser } from '@whiskeysockets/baileys'
import * as settings from './settings.js'
import { num, botIds, getBody, participantIds } from './utils.js'
import { log } from './logger.js'

const g = jid => settings.group(jid)
const isBotId = id => /^(3EB0|BAE5|B24E|WA)[0-9A-F]{6,}/i.test(String(id || '')) && String(id).length !== 20 && !/^3A/.test(String(id))
const flood = new Map() // jid|sender -> [t]
const recent = new Map() // msg id -> text (antiedit)
const remember = (id, t) => { if (!id || !t) return; recent.set(id, t); if (recent.size > 2000) recent.delete(recent.keys().next().value) }

export async function warnUser (ctx, j, why) {
  const gs = g(ctx.jid); gs.warns = gs.warns || {}
  const n = (gs.warns[j] = (gs.warns[j] || 0) + 1)
  const max = gs.warnMax || 3
  settings.save()
  if (n >= max && ctx.isBotAdmin) {
    delete gs.warns[j]; settings.save()
    await ctx.sock.sendMessage(ctx.jid, { text: `🚫 @${num(j)} ko ${max} warnings ho gayi — nikal diya.\nWajah: ${why}`, mentions: [j] })
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [j], 'remove').catch(() => {})
  } else {
    await ctx.sock.sendMessage(ctx.jid, { text: `⚠️ @${num(j)} warning *${n}/${max}*\nWajah: ${why}`, mentions: [j] })
  }
}
async function del (ctx) { if (ctx.isBotAdmin) await ctx.sock.sendMessage(ctx.jid, { delete: ctx.msg.key }).catch(() => {}) }
async function punish (ctx, mode, why) {
  await del(ctx)
  if (mode === 'kick' && ctx.isBotAdmin) { await ctx.sock.sendMessage(ctx.jid, { text: `🚫 @${num(ctx.sender)} nikal diya. Wajah: ${why}`, mentions: [ctx.sender] }); return ctx.sock.groupParticipantsUpdate(ctx.jid, [ctx.sender], 'remove').catch(() => {}) }
  if (mode === 'warn') return warnUser(ctx, ctx.sender, why)
}

// true = message rok diya (aage command / AI nahi)
export async function groupGuard (ctx) {
  const m = ctx.msg.message || {}
  // banned users: bot unki commands ignore kare (har jagah)
  const ban = settings.get('banned') || []
  if (ctx.isCmd && !ctx.owner && ban.includes(jidNormalizedUser(ctx.sender))) return true
  // mention reply (DM ya group): jab koi owner/bot ko tag kare
  try { await mentionReply(ctx) } catch {}
  if (!ctx.isGroup || ctx.msg.key.fromMe) { remember(ctx.msg.key.id, ctx.body); return false }
  const gs = g(ctx.jid)
  const exempt = ctx.isAdmin || ctx.owner
  // antiedit: edit hua message dikhao
  const ed = m.protocolMessage?.editedMessage || m.editedMessage?.message?.protocolMessage?.editedMessage
  if (ed) {
    if (gs.antiEdit) {
      const id = m.protocolMessage?.key?.id || m.editedMessage?.message?.protocolMessage?.key?.id
      const old = recent.get(id); const nu = getBody(ed)
      if (old && nu && old !== nu) await ctx.sock.sendMessage(ctx.jid, { text: `✏️ *Anti-Edit*\n@${num(ctx.sender)} ne message edit kiya\n\n*Pehle:* ${old}\n*Ab:* ${nu}`, mentions: [ctx.sender] })
      remember(id, nu)
    }
    return true
  }
  remember(ctx.msg.key.id, ctx.body)
  if (exempt) return false
  if (gs.antiBot && isBotId(ctx.msg.key.id)) { await punish(ctx, gs.antiBot === 'warn' ? 'warn' : 'kick', 'dusra bot allowed nahi'); return true }
  if (gs.antiSticker && m.stickerMessage) { await punish(ctx, gs.antiSticker, 'sticker band hain'); return true }
  if (gs.lockFrwrd && (m.extendedTextMessage?.contextInfo?.isForwarded || Object.values(m).some(v => v?.contextInfo?.isForwarded))) { await punish(ctx, gs.lockFrwrd, 'forward message band hain'); return true }
  if (gs.antiStatus && (m.groupStatusMentionMessage || m.groupMentionedMessage)) { await punish(ctx, gs.antiStatus, 'status mention band hai'); return true }
  if (gs.antiTag) {
    const n = (m.extendedTextMessage?.contextInfo?.mentionedJid || []).length
    if (n >= (gs.antiTagMax || 5)) { await punish(ctx, gs.antiTag, 'zyada log tag kiye'); return true }
  }
  if (gs.antiFlood) {
    const k = ctx.jid + '|' + ctx.sender; const now = Date.now()
    const arr = (flood.get(k) || []).filter(t => now - t < 10000); arr.push(now); flood.set(k, arr)
    if (flood.size > 3000) flood.clear()
    if (arr.length === (gs.floodMax || 7)) { await punish(ctx, gs.antiFlood, 'spam / flood'); return true }
  }
  if (gs.antiBadword && ctx.body) {
    const words = gs.badwords?.length ? gs.badwords : (settings.get('badwords') || [])
    const low = ctx.body.toLowerCase()
    const hit = words.find(w => w && new RegExp('(^|[^a-z0-9])' + w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(low))
    if (hit) { await punish(ctx, gs.badwordAction || 'warn', 'ganda lafz'); return true }
  }
  return false
}

const mrLast = new Map()
async function mentionReply (ctx) {
  const s = settings.load()
  if (!s.mentionReply || ctx.msg.key.fromMe) return
  const me = botIds(ctx.sock)
  const ment = (ctx.mentioned || []).map(j => jidNormalizedUser(j))
  if (!ment.some(j => me.includes(j))) return
  const k = ctx.jid + '|' + ctx.sender
  if (Date.now() - (mrLast.get(k) || 0) < 60000) return
  mrLast.set(k, Date.now())
  if (s.mentionAudio) { await ctx.sock.sendMessage(ctx.jid, { audio: String(s.mentionAudio).startsWith('b64:') ? Buffer.from(s.mentionAudio.slice(4), 'base64') : { url: s.mentionAudio }, mimetype: 'audio/mpeg', ptt: !!s.mentionPtt }, { quoted: ctx.msg }).catch(() => {}); return }
  await ctx.reply(s.mentionText || '👋 Abhi busy hoon, thori der mein jawab deta hoon.\n_— AQDAS MD_')
}

// group-participants.update: antidemote / antipromote / adminalert / lockadmin / akick
export async function groupEventGuard (bot, ev) {
  const gs = g(ev.id); const sock = bot.sock
  const me = botIds(sock)
  const author = ev.author ? jidNormalizedUser(ev.author) : null
  const ids = (ev.participants || []).map(p => participantIds(p)[0]).filter(Boolean)
  if (author && me.includes(author)) return // bot ne khud kiya
  const say = (text, mentions) => sock.sendMessage(ev.id, { text, mentions }).catch(() => {})
  if (gs.adminAlert && (ev.action === 'promote' || ev.action === 'demote')) await say(`🔔 *Admin alert*\n${ids.map(j => '@' + num(j)).join(' ')} ${ev.action === 'promote' ? 'ko admin bana diya gaya 👑' : 'ko admin se hata diya gaya'}${author ? '\nBy: @' + num(author) : ''}`, [...ids, author].filter(Boolean))
  if (ev.action === 'demote' && gs.antiDemote) {
    await sock.groupParticipantsUpdate(ev.id, ids, 'promote').catch(() => {})
    if (author) await sock.groupParticipantsUpdate(ev.id, [author], 'demote').catch(() => {})
    await say(`🛡 *Anti-Demote*: ${ids.map(j => '@' + num(j)).join(' ')} wapas admin.${author ? ' @' + num(author) + ' ka admin hata diya.' : ''}`, [...ids, author].filter(Boolean))
  }
  if (ev.action === 'promote' && (gs.antiPromote || gs.lockAdmin)) {
    await sock.groupParticipantsUpdate(ev.id, ids, 'demote').catch(() => {})
    if (author && gs.antiPromote) await sock.groupParticipantsUpdate(ev.id, [author], 'demote').catch(() => {})
    await say(`🔒 *${gs.lockAdmin ? 'Admin lock' : 'Anti-Promote'}*: naye admin nahi ban sakte. ${ids.map(j => '@' + num(j)).join(' ')} hata diye.`, ids)
  }
  if (ev.action === 'add' && gs.antiAdmin && author && ids.length) { /* reserved */ }
  if (ev.action === 'add' && gs.akick?.length) {
    const bad = ids.filter(j => gs.akick.includes(num(j)))
    if (bad.length) { await sock.groupParticipantsUpdate(ev.id, bad, 'remove').catch(() => {}); await say(`🚫 Auto-kick: ${bad.map(j => '@' + num(j)).join(' ')}`, bad) }
  }
}

// call aaye to reject (anticall on)
const callWarned = new Map()
export async function callGuard (bot, calls) {
  if (!settings.get('antiCall')) return
  for (const c of calls || []) {
    if (c.status !== 'offer') continue
    try { await bot.sock.rejectCall(c.id, c.from) } catch (e) { log.warn('anticall:', e?.message) }
    if (Date.now() - (callWarned.get(c.from) || 0) > 300000) {
      callWarned.set(c.from, Date.now())
      await bot.sock.sendMessage(c.from, { text: settings.get('antiCallText') || '📵 Call allowed nahi. Message karo please.\n_— AQDAS MD_' }).catch(() => {})
    }
  }
}
export const _test = { isBotId, recent }

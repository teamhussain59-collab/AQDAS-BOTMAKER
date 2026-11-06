// .sreact / .react: bot ka APNA number (jis ne bot deploy kiya) reply wale message pe reaction lagaye.
// WhatsApp mein ek number ek message pe sirf 1 reaction rakh sakta hai, is liye ye ek hi lagata hai.
const PICK = ['❤️', '🔥', '😂', '😍', '👍', '💯', '😎', '🥰', '👑', '✨', '😮', '🙏', '💀', '🤩', '⚡']
async function react (ctx, emoji) {
  const key = ctx.quoted?.key
  if (!key) return ctx.reply(`Kisi message pe reply karke likho: ${ctx.prefix}${ctx.command} 🔥`)
  const k = { remoteJid: ctx.jid, id: key.id, fromMe: !!key.fromMe, participant: key.participant }
  await ctx.sock.sendMessage(ctx.jid, { react: { text: emoji, key: k } })
}
export default [
  { name: 'react', alias: ['sreact', 'reactmsg'], category: 'tools', owner: true, usage: '<emoji> (message pe reply)', desc: 'Apne number se message pe reaction', async run (ctx) {
    const e = (ctx.text || '').trim().split(/\s+/)[0]
    const emoji = e && !/^\d+$/.test(e) ? e : PICK[Math.floor(Math.random() * PICK.length)]
    await react(ctx, emoji)
  } },
  { name: 'unreact', alias: ['delreact'], category: 'tools', owner: true, usage: '(message pe reply)', desc: 'Apna reaction hatao', async run (ctx) { await react(ctx, '') } }
]

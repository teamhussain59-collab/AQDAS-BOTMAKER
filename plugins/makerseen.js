// .seen <number>: sirf in numbers ka har naya status bot khud seen kare (autostatus off ho tab bhi)
const dg = s => String(s || '').replace(/\D/g, '')
const fix = n => { n = dg(n); if (n.startsWith('03') && n.length === 11) n = '92' + n.slice(1); return n }
const list = ctx => { const s = ctx.settings.load(); if (!Array.isArray(s.seenList)) s.seenList = []; return s }
const show = ns => ns.length ? ns.map((n, i) => `${i + 1}. +${n}`).join('\n') : '(khaali)'

export default [
  {
    name: 'seen', alias: ['autoseen', 'watchstatus', 'seennum'], category: 'auto', owner: true, usage: '<number>',
    desc: 'Is number ka har naya status khud seen. Misal: .seen 923001234567',
    async run (ctx) {
      const s = list(ctx)
      let n = fix(ctx.args.join(''))
      if (!n && ctx.quoted?.sender) n = dg(String(ctx.quoted.sender).split('@')[0])
      if (!n && ctx.mentions?.[0]) n = dg(String(ctx.mentions[0]).split('@')[0])
      if (n.length < 8 || n.length > 15) return ctx.reply(`Number do jani\nMisal: ${ctx.prefix}seen 923001234567\n\nList: ${ctx.prefix}seenlist\nHatao: ${ctx.prefix}unseen 923001234567`)
      if (s.seenList.includes(n)) return ctx.reply(`+${n} pehle se list mein hai ✅`)
      if (s.seenList.length >= 200) return ctx.reply('List full (200). Pehle kuch hatao: ' + ctx.prefix + 'unseen <number>')
      s.seenList.push(n); ctx.settings.save()
      await ctx.reply(`✅ +${n} add ho gaya\nAb is ka har naya status bot khud seen karega 👀\n\nNote: status tabhi aata hai jab us ne aap ka number save kiya ho (WhatsApp ka rule).\nList: ${ctx.prefix}seenlist | Hatao: ${ctx.prefix}unseen ${n}`)
    }
  },
  {
    name: 'unseen', alias: ['delseen', 'rmseen', 'stopseen'], category: 'auto', owner: true, usage: '<number|all>',
    desc: 'Number ko .seen list se hatao (all = sab)',
    async run (ctx) {
      const s = list(ctx)
      const a = ctx.args.join('').toLowerCase()
      if (a === 'all') { s.seenList = []; ctx.settings.save(); return ctx.reply('✅ .seen list saaf') }
      const n = fix(a)
      if (!n) return ctx.reply(`Use: ${ctx.prefix}unseen 923001234567 / ${ctx.prefix}unseen all`)
      const before = s.seenList.length
      s.seenList = s.seenList.filter(x => x !== n); ctx.settings.save()
      await ctx.reply(s.seenList.length < before ? `✅ +${n} hata diya` : `+${n} list mein tha hi nahi`)
    }
  },
  {
    name: 'seenlist', alias: ['listseen', 'seenl'], category: 'auto', owner: true,
    desc: 'Jin numbers ka status auto seen hota hai',
    async run (ctx) { const s = list(ctx); await ctx.reply(`👀 *Auto Seen List* (${s.seenList.length})\n${show(s.seenList)}`) }
  }
]

// AI text -> image -> sticker (Bot Maker). Free image API, koi key nahi chahiye
import fs from 'fs'
import { toSticker } from '../lib/media.js'
import { run, tmpFile, rm } from '../lib/utils.js'
import config from '../config.js'

async function gen (prompt, extra = '') {
  const seed = Math.floor(Math.random() * 1e9)
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + extra) + `?width=512&height=576&nologo=true&seed=${seed}`
  let last
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const b = Buffer.from(await r.arrayBuffer())
      if (b.length < 2000) throw new Error('khali image')
      return await cropMark(b)
    } catch (e) { last = e }
  }
  throw last
}
// neeche ka watermark kaat do (576 -> 512 square)
async function cropMark (buf) {
  const a = tmpFile('jpg'), b = tmpFile('png')
  fs.writeFileSync(a, buf)
  try { await run('ffmpeg', ['-y', '-i', a, '-vf', 'crop=iw:iw:0:0', '-frames:v', '1', b]); return fs.readFileSync(b) } catch { return buf } finally { rm(a, b) }
}
const need = ctx => { const t = (ctx.text || '').trim(); if (!t) { ctx.reply(`✍️ Kuch likho: *${ctx.prefix}${ctx.command} cute cat with sunglasses*`); return null } return t.slice(0, 400) }

export default [
  {
    name: 'aisticker', alias: ['txt2stk', 'aistk', 'texttosticker', 'stickerai'], category: 'sticker', usage: '<text>', desc: 'Text likho, AI us ka sticker bana dega',
    async run (ctx) {
      const t = need(ctx); if (!t) return
      await ctx.react('⏳')
      try {
        const img = await gen(t, ', sticker style, simple background, cute, high quality')
        const [pack, author] = [config.packname, config.author]
        await ctx.reply({ sticker: await toSticker(img, { pack, author }) })
        await ctx.react('✅')
      } catch (e) { console.error('aistk', e?.message || e); await ctx.react('❌'); await ctx.reply('❌ Image nahi bani, thori der baad try karo') }
    }
  },
  {
    name: 'aiimg', alias: ['txt2img', 'texttoimg', 'imagine', 'aiphoto', 'genimg'], category: 'ai', usage: '<text>', desc: 'Text se AI photo banao',
    async run (ctx) {
      const t = need(ctx); if (!t) return
      await ctx.react('⏳')
      try {
        await ctx.reply({ image: await gen(t), caption: `🎨 *${t}*\n\n> © ${config.botName}` })
        await ctx.react('✅')
      } catch (e) { console.error('aistk', e?.message || e); await ctx.react('❌'); await ctx.reply('❌ Image nahi bani, thori der baad try karo') }
    }
  }
]

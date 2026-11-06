// .removebg: photo ka background hata do (free, koi key nahi: HuggingFace public spaces)
import fs from 'fs'
import { toSticker } from '../lib/media.js'
import { run as sh, tmpFile, rm } from '../lib/utils.js'

// webp/kuch bhi -> png (transparent rahe)
async function toPng (b) {
  if (b[0] === 0x89 && b[1] === 0x50) return b
  const a = tmpFile('webp'), o = tmpFile('png')
  fs.writeFileSync(a, b)
  try { await sh('ffmpeg', ['-y', '-i', a, '-frames:v', '1', o]); return fs.readFileSync(o) } catch { return b } finally { rm(a, o) }
}

const SPACES = [
  { base: 'https://kenjiedec-rembg.hf.space', ep: 'inference', data: f => [f, 'isnet-general-use', 0, 0] },
  { base: 'https://kenjiedec-rembg.hf.space', ep: 'inference', data: f => [f, 'u2netp', 0, 0] },
  { base: 'https://not-lain-background-removal.hf.space', ep: 'png', data: f => [f] },
  { base: 'https://zhengpeng7-birefnet-demo.hf.space', ep: 'image', data: f => [f, '1024x1024', 'General'], pick: d => d[0]?.[1] || d[0]?.[0] }
]

async function viaSpace (s, buf) {
  const fd = new FormData()
  fd.append('files', new Blob([buf], { type: 'image/jpeg' }), 'photo.jpg')
  const up = await fetch(s.base + '/gradio_api/upload', { method: 'POST', body: fd, signal: AbortSignal.timeout(30000) })
  if (!up.ok) throw new Error('upload ' + up.status)
  const [p] = await up.json()
  const file = { path: p, meta: { _type: 'gradio.FileData' } }
  const c = await fetch(`${s.base}/gradio_api/call/${s.ep}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: s.data(file) }), signal: AbortSignal.timeout(30000) })
  if (!c.ok) throw new Error('call ' + c.status)
  const { event_id: id } = await c.json()
  const ev = await fetch(`${s.base}/gradio_api/call/${s.ep}/${id}`, { signal: AbortSignal.timeout(120000) })
  const txt = await ev.text()
  if (/event: error/.test(txt)) throw new Error('space error')
  const line = txt.split('\n').filter(l => l.startsWith('data:')).pop()
  const d = JSON.parse(line.slice(5))
  let out = s.pick ? s.pick(d) : d[0]
  if (out?.image) out = out.image
  const url = out?.path ? `${s.base}/gradio_api/file=${out.path}` : out?.url
  if (!url) throw new Error('result khali')
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) })
  const b = Buffer.from(await r.arrayBuffer())
  if (b.length < 500) throw new Error('chhoti file')
  return toPng(b)
}

export async function removeBg (buf) {
  const errs = []
  for (const s of SPACES) { try { return await viaSpace(s, buf) } catch (e) { errs.push(e.message) } }
  throw new Error(errs.join(' | '))
}

async function run (ctx, asSticker) {
  if (ctx.targetType !== 'image' && ctx.targetType !== 'imageMessage') {
    return ctx.reply(`📸 Kisi *photo* pe reply karke likho: *${ctx.prefix}${ctx.command}*`)
  }
  await ctx.react('⏳')
  let buf
  try { buf = await ctx.download() } catch { await ctx.react('❌'); return ctx.reply('❌ Photo download nahi hui, dobara bhejo') }
  let png
  try { png = await removeBg(buf) } catch (e) { await ctx.react('❌'); return ctx.reply('❌ Background abhi nahi hata (free server busy). 1-2 min baad try karo.') }
  if (asSticker) {
    const st = await toSticker(png, { pack: 'AQDAS', author: 'removebg' }).catch(() => null)
    if (st) { await ctx.reply({ sticker: st }); return ctx.react('✅') }
  }
  await ctx.reply({ document: png, mimetype: 'image/png', fileName: 'nobg.png', caption: '✅ Background hata diya (PNG, transparent)\n_— AQDAS MD_' })
  await ctx.reply({ image: png, caption: '🖼 Preview' }).catch(() => {})
  await ctx.react('✅')
}

export default [
  { name: 'removebg', alias: ['rmbg', 'nobg', 'bgremove'], category: 'tools', usage: '(photo pe reply)', desc: 'Photo ka background hatao (transparent PNG)', run: ctx => run(ctx, false) },
  { name: 'nobgsticker', alias: ['rmbgsticker', 'bgsticker'], category: 'sticker', usage: '(photo pe reply)', desc: 'Background hata ke sticker bana do', run: ctx => run(ctx, true) }
]

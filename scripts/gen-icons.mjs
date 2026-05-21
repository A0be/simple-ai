// scripts/gen-icons.mjs
// 生成 Tauri 桌面应用所需的 1024x1024 源 PNG 图标。
// 仅使用 Node.js 内置模块（zlib），无需任何额外依赖。
// 用法：node scripts/gen-icons.mjs
//
// 生成后运行：npx tauri icon scripts/source.png
// 这条命令会自动生成 src-tauri/icons/ 下所有需要的格式。

import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ============ CRC32（PNG 校验所需）============
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

// ============ 生成 PNG ============
function createSolidPng(width, height, color) {
  const [r, g, b, a] = color
  // 每行：1 字节滤波器（0）+ 像素数据（RGBA = 4 字节/像素）
  const rowSize = width * 4 + 1
  const raw = Buffer.alloc(rowSize * height)
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0 // 滤波器：None
    for (let x = 0; x < width; x++) {
      const idx = y * rowSize + 1 + x * 4
      raw[idx] = r
      raw[idx + 1] = g
      raw[idx + 2] = b
      raw[idx + 3] = a
    }
  }
  return assemblePng(width, height, raw)
}

function createLogoPng(size) {
  // 深色背景 + 浅色横条 + 一个蓝色圆点（模拟首页 logo）
  const rowSize = size * 4 + 1
  const raw = Buffer.alloc(rowSize * size)

  const bg = [15, 23, 42, 255] // #0f172a
  const lineLight = [255, 255, 255, 255]
  const lineDim = [148, 163, 184, 255]
  const dot = [56, 189, 248, 255]

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0
    for (let x = 0; x < size; x++) {
      const idx = y * rowSize + 1 + x * 4
      let c = bg
      // 三条横线（简易卡片造型）
      const lineHeight = Math.max(2, Math.floor(size * 0.07))
      const lines = [
        { top: size * 0.32, width: size * 0.5, color: lineLight },
        { top: size * 0.46, width: size * 0.38, color: lineLight },
        { top: size * 0.6, width: size * 0.44, color: lineDim }
      ]
      const startX = size * 0.22
      for (const ln of lines) {
        if (
          y >= ln.top &&
          y < ln.top + lineHeight &&
          x >= startX &&
          x < startX + ln.width
        ) {
          c = ln.color
        }
      }
      // 蓝色圆点
      const dotCx = size * 0.74
      const dotCy = size * 0.66
      const dotR = size * 0.06
      const dx = x - dotCx
      const dy = y - dotCy
      if (dx * dx + dy * dy <= dotR * dotR) c = dot

      raw[idx] = c[0]
      raw[idx + 1] = c[1]
      raw[idx + 2] = c[2]
      raw[idx + 3] = c[3]
    }
  }
  return assemblePng(size, size, raw)
}

function assemblePng(width, height, raw) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // 颜色类型：RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const idat = deflateSync(raw)
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ============ 输出 ============
const outDir = join(__dirname)
mkdirSync(outDir, { recursive: true })

const sourcePath = join(outDir, 'source.png')
writeFileSync(sourcePath, createLogoPng(1024))
console.log(`✓ 已生成源图标：${sourcePath} (1024x1024)`)

// PWA 图标
const publicIcons = join(__dirname, '..', 'public', 'icons')
mkdirSync(publicIcons, { recursive: true })
writeFileSync(join(publicIcons, 'icon-192.png'), createLogoPng(192))
writeFileSync(join(publicIcons, 'icon-512.png'), createLogoPng(512))
console.log('✓ 已生成 PWA 图标到 public/icons/')

// Tauri 桌面图标（PNG 部分）
const tauriIcons = join(__dirname, '..', 'src-tauri', 'icons')
mkdirSync(tauriIcons, { recursive: true })
writeFileSync(join(tauriIcons, '32x32.png'), createLogoPng(32))
writeFileSync(join(tauriIcons, '128x128.png'), createLogoPng(128))
writeFileSync(join(tauriIcons, '128x128@2x.png'), createLogoPng(256))
writeFileSync(join(tauriIcons, 'icon.png'), createLogoPng(512))

// Windows Store / Tauri 备用 PNG
writeFileSync(join(tauriIcons, 'Square30x30Logo.png'), createLogoPng(30))
writeFileSync(join(tauriIcons, 'Square44x44Logo.png'), createLogoPng(44))
writeFileSync(join(tauriIcons, 'Square71x71Logo.png'), createLogoPng(71))
writeFileSync(join(tauriIcons, 'Square89x89Logo.png'), createLogoPng(89))
writeFileSync(join(tauriIcons, 'Square107x107Logo.png'), createLogoPng(107))
writeFileSync(join(tauriIcons, 'Square142x142Logo.png'), createLogoPng(142))
writeFileSync(join(tauriIcons, 'Square150x150Logo.png'), createLogoPng(150))
writeFileSync(join(tauriIcons, 'Square284x284Logo.png'), createLogoPng(284))
writeFileSync(join(tauriIcons, 'Square310x310Logo.png'), createLogoPng(310))
writeFileSync(join(tauriIcons, 'StoreLogo.png'), createLogoPng(50))
console.log('✓ 已生成 Tauri PNG 图标到 src-tauri/icons/')

console.log()
console.log('如需打包 Windows .exe 或 macOS .dmg，请额外运行：')
console.log('  npx tauri icon scripts/source.png')
console.log('（这会用源图自动生成 icon.ico 和 icon.icns）')

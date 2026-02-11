/**
 * Generate SessionSync icons — horizontal S-curve with opposing arrows
 * Path: ←── bottom ──╮ right-U ╭── middle ──╯ left-U ╰── top ──→
 * Run: node scripts/generate-icons.js
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetsDir = join(__dirname, '..', 'public', 'assets')
mkdirSync(assetsDir, { recursive: true })

// ── PNG helpers ─────────────────────────────────────────────────

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[i] = c >>> 0
}

function crc32(data) {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = (crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)) >>> 0
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

// ── Drawing helpers ─────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t }
function clamp01(v) { return Math.max(0, Math.min(1, v)) }

function sdfRoundedRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.max(Math.abs(px - cx) - hw + r, 0)
  const dy = Math.max(Math.abs(py - cy) - hh + r, 0)
  return Math.sqrt(dx * dx + dy * dy) - r
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  const t = clamp01(((px - x1) * dx + (py - y1) * dy) / len2)
  return Math.sqrt((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2)
}

// ── Cubic bezier → polyline ─────────────────────────────────────

function bezierPoint(t, x0, y0, x1, y1, x2, y2, x3, y3) {
  const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt
  const t2 = t * t, t3 = t2 * t
  return [
    mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3,
    mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3,
  ]
}

function bezierToSegments(x0, y0, x1, y1, x2, y2, x3, y3, n = 16) {
  const segs = []
  let [px, py] = [x0, y0]
  for (let i = 1; i <= n; i++) {
    const [nx, ny] = bezierPoint(i / n, x0, y0, x1, y1, x2, y2, x3, y3)
    segs.push([px, py, nx, ny])
    px = nx; py = ny
  }
  return segs
}

// ── S-arrow design (24×24 coordinate space) ─────────────────────
//
//  Layout (3 horizontal levels connected by semicircular arcs):
//
//       ╭──────────→   y=5  (top arm → right arrow)
//      │                    (left arc r=3.5)
//       ╰──────╮       y=12 (middle arm)
//              │            (right arc r=3.5)
//  ←───────────╯       y=19 (bottom arm → left arrow)
//

const STROKE_24 = 2.0
const CENTER_24 = 12
const BBOX_SIZE = 20 // bounding box max dim: y spans 2→22 = 20

const KAPPA = 0.5523 // cubic bezier kappa for 90° arcs
const R = 3.5        // semicircle radius
const KR = KAPPA * R // ≈ 1.933

function buildSegments24() {
  const segs = []

  // Left arrowhead ← at (3, 19)
  segs.push([6, 16, 3, 19])
  segs.push([3, 19, 6, 22])

  // Bottom arm: (3,19) → (14,19)
  segs.push([3, 19, 14, 19])

  // Right semicircle: (14,19) → (17.5,15.5) → (14,12)  center=(14,15.5) r=3.5
  segs.push(...bezierToSegments(14, 19, 14 + KR, 19, 17.5, 15.5 + KR, 17.5, 15.5))
  segs.push(...bezierToSegments(17.5, 15.5, 17.5, 15.5 - KR, 14 + KR, 12, 14, 12))

  // Middle arm: (14,12) → (10,12)
  segs.push([14, 12, 10, 12])

  // Left semicircle: (10,12) → (6.5,8.5) → (10,5)  center=(10,8.5) r=3.5
  segs.push(...bezierToSegments(10, 12, 10 - KR, 12, 6.5, 8.5 + KR, 6.5, 8.5))
  segs.push(...bezierToSegments(6.5, 8.5, 6.5, 8.5 - KR, 10 - KR, 5, 10, 5))

  // Top arm: (10,5) → (21,5)
  segs.push([10, 5, 21, 5])

  // Right arrowhead → at (21, 5)
  segs.push([18, 2, 21, 5])
  segs.push([21, 5, 18, 8])

  return segs
}

const SEGMENTS_24 = buildSegments24()

// ── Icon generator ──────────────────────────────────────────────

function createPNG(size) {
  const s = size
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(s, 0)
  ihdrData.writeUInt32BE(s, 4)
  ihdrData.writeUInt8(8, 8)
  ihdrData.writeUInt8(6, 9)
  const ihdr = chunk('IHDR', ihdrData)

  const cx = s / 2, cy = s / 2
  const pad = s * 0.06
  const halfW = s / 2 - pad, halfH = s / 2 - pad
  const cornerR = s * 0.22

  const fitScale = (s * 0.65) / BBOX_SIZE
  const halfStroke = (STROKE_24 * fitScale) / 2

  function toIcon(x24, y24) {
    return [
      (x24 - CENTER_24) * fitScale + cx,
      (y24 - CENTER_24) * fitScale + cy,
    ]
  }

  const segments = SEGMENTS_24.map(([x1, y1, x2, y2]) => {
    const [ix1, iy1] = toIcon(x1, y1)
    const [ix2, iy2] = toIcon(x2, y2)
    return [ix1, iy1, ix2, iy2]
  })

  const raw = []

  for (let y = 0; y < s; y++) {
    raw.push(0)
    for (let x = 0; x < s; x++) {
      const px = x + 0.5, py = y + 0.5

      const d = sdfRoundedRect(px, py, cx, cy, halfW, halfH, cornerR)
      if (d > 1) { raw.push(0, 0, 0, 0); continue }
      const bgAlpha = clamp01(1 - d)

      const gt = clamp01(((x + y) / s - 0.3) / 0.8)
      const bgR = Math.round(lerp(14, 20, gt))    // sky-500 → teal-500
      const bgG = Math.round(lerp(165, 184, gt))
      const bgB = Math.round(lerp(233, 166, gt))

      let minDist = Infinity
      for (const [x1, y1, x2, y2] of segments) {
        const dist = distToSegment(px, py, x1, y1, x2, y2)
        if (dist < minDist) minDist = dist
      }

      const arrowAlpha = clamp01(halfStroke - minDist + 0.5)

      const r = Math.round(lerp(bgR, 255, arrowAlpha))
      const g = Math.round(lerp(bgG, 255, arrowAlpha))
      const b = Math.round(lerp(bgB, 255, arrowAlpha))
      const a = Math.round(bgAlpha * 255)

      raw.push(r, g, b, a)
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(raw), { level: 9 })
  return Buffer.concat([sig, ihdr, chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

// ── Generate ────────────────────────────────────────────────────

for (const size of [16, 32, 48, 128]) {
  const png = createPNG(size)
  writeFileSync(join(assetsDir, `icon-${size}.png`), png)
  console.log(`  icon-${size}.png  (${png.length} bytes)`)
}
console.log('Done!')

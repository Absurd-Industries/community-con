// Renders scripts/og/og-image.html -> public/og-image.png (1200x630).
// Shoots at 2x in headless Chrome for crisp type, then downsamples with sharp.
//   node apps/web/scripts/og/render-og.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const source = join(here, 'og-image.html')
const out = resolve(here, '../../public/og-image.png')

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('No Chrome/Chromium found. Checked:\n  ' + CHROME_CANDIDATES.join('\n  '))
  process.exit(1)
}

const tmp = mkdtempSync(join(tmpdir(), 'og-'))
const shot = join(tmp, 'shot.png')

try {
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      '--window-size=1200,630',
      // Give webfonts time to load and paint before the capture.
      '--virtual-time-budget=8000',
      `--screenshot=${shot}`,
      pathToFileURL(source).href,
    ],
    { stdio: 'pipe' },
  )

  await sharp(shot)
    .resize(1200, 630, { fit: 'cover' })
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(out)

  const { size } = await sharp(out).metadata().then(async (m) => ({ ...m, size: (await sharp(out).toBuffer()).length }))
  console.log(`Wrote ${out} (1200x630, ${Math.round(size / 1024)} KB)`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

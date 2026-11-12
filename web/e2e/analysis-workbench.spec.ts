import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

function stereoWav(seconds: number): Buffer {
  const rate = 48_000
  const frames = seconds * rate
  const bytes = Buffer.alloc(44 + frames * 4)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(2, 22)
  bytes.writeUInt32LE(rate, 24)
  bytes.writeUInt32LE(rate * 4, 28)
  bytes.writeUInt16LE(4, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 4, 40)
  for (let frame = 0; frame < frames; frame++) {
    const sample = Math.round(
      Math.sin((frame * 2 * Math.PI * 1000) / rate) * 3000,
    )
    bytes.writeInt16LE(sample, 44 + frame * 4)
    bytes.writeInt16LE(sample, 46 + frame * 4)
  }
  return bytes
}

test('120 second stereo source keeps analysis responsive across navigation and replacement', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/editor')
  await page.getByLabel('Select local audio file').setInputFiles({
    name: 'synthetic-stereo.wav',
    mimeType: 'audio/wav',
    buffer: stereoWav(120),
  })
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeEnabled({ timeout: 30_000 })
  await page.getByText('Waveform view', { exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Navigation', exact: true })
    .selectOption('trackpad')
  await page
    .getByRole('combobox', { name: 'Amplitude', exact: true })
    .selectOption('logarithmic')
  await page.getByRole('checkbox', { name: 'Split stereo channels' }).check()
  await page.getByRole('checkbox', { name: 'Gap ruler', exact: true }).check()
  await page.getByText('Waveform view', { exact: true }).click()
  for (const name of ['Spectrogram', 'Spectrum', 'Meter'])
    await page.getByRole('button', { name, exact: true }).click()
  await page
    .getByRole('button', { name: 'Zoom in', exact: true })
    .click({ clickCount: 3 })
  const waveform = page.getByRole('region', { name: /^Audio waveform/ })
  const scroll = waveform.locator('[part~="scroll"]').first()
  await waveform.hover({ position: { x: 250, y: 50 } })
  const originalScroll = await scroll.evaluate((element) => element.scrollLeft)
  await page.mouse.wheel(0, 180)
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(originalScroll)
  const originalWidth = await scroll.evaluate((element) => element.scrollWidth)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollWidth))
    .toBeGreaterThan(originalWidth)
  await waveform.click({ position: { x: 250, y: 50 } })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Jump to end' }).click()
  await page.getByRole('button', { name: 'Jump to start' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.screenshot({
    path: 'test-results/analysis-stereo-120s.png',
    fullPage: true,
  })
  await page.getByLabel('Select local audio file').setInputFiles({
    name: 'replacement.wav',
    mimeType: 'audio/wav',
    buffer: stereoWav(3),
  })
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Spectrum', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Real-time spectrum analyzer' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

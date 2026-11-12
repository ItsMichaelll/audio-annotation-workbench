import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'

function sineWav(seconds = 4): Buffer {
  const rate = 48000
  const frames = rate * seconds
  const wav = Buffer.alloc(44 + frames * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(frames * 2, 40)
  for (let frame = 0; frame < frames; frame++) {
    wav.writeInt16LE(
      Math.round(Math.sin((frame * 2 * Math.PI * 440) / rate) * 4000),
      44 + frame * 2,
    )
  }
  return wav
}

for (const width of [1440, 1048, 640]) {
  test(`focus preserves loaded audio at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/editor')
    await page.getByLabel('Select local audio file').setInputFiles({
      name: 'synthetic-tone.wav',
      mimeType: 'audio/wav',
      buffer: sineWav(),
    })
    await expect(
      page.getByRole('button', { name: 'Play', exact: true }),
    ).toBeEnabled()
    await page
      .getByRole('button', { name: 'Create region at playhead' })
      .click()
    await expect(
      page.getByRole('button', { name: 'Loop', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Loop', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await page.screenshot({ path: `test-results/normal-${width}.png` })
    const media = page.locator('audio').first()
    const mediaCount = await page.locator('audio').count()
    const source = await media.getAttribute('src')
    await page
      .getByRole('button', {
        name: 'Normal editor. Switch to Waveform and annotations',
      })
      .click()
    await expect(page.locator('[data-focus-mode="annotations"]')).toBeVisible()
    await page.screenshot({
      path: `test-results/focus-annotations-${width}.png`,
    })
    await page
      .getByRole('button', {
        name: 'Waveform and annotations. Switch to Waveform only',
      })
      .click()
    await expect(page.locator('[data-focus-mode="waveform"]')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Play', exact: true }),
    ).toBeVisible()
    await page.screenshot({ path: `test-results/focus-waveform-${width}.png` })
    await page
      .getByRole('button', { name: 'Waveform only. Switch to Normal editor' })
      .click()
    await expect(page.locator('[data-focus-mode="normal"]')).toBeVisible()
    expect(await media.getAttribute('src')).toBe(source)
    expect(await page.locator('audio').count()).toBe(mediaCount)
    expect(errors).toEqual([])
  })
}

test('project inspector keeps its tab across selection and focus changes', async ({
  page,
}) => {
  await page.goto('/projects/new')
  await page.getByLabel('Project name').fill('Synthetic review')
  await page.locator('input[type="file"][accept*=".yaml"]').setInputFiles({
    name: 'synthetic-taxonomy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        labels: [{ id: 'sample', name: 'Sample', shortcut: '1' }],
      }),
    ),
  })
  await page.getByLabel('Audio files to import').setInputFiles({
    name: 'synthetic.wav',
    mimeType: 'audio/wav',
    buffer: sineWav(),
  })
  await page.getByRole('button', { name: 'Confirm import' }).click()
  await page
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await page.getByRole('link', { name: 'Start Labeling' }).click()
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeEnabled()
  await page.getByRole('tab', { name: 'Clip & info' }).click()
  await page.getByRole('button', { name: 'Create region at playhead' }).click()
  await expect(page.getByRole('tab', { name: 'Clip & info' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page
    .getByRole('button', {
      name: 'Normal editor. Switch to Waveform and annotations',
    })
    .click()
  await expect(page.getByRole('tab', { name: 'Clip & info' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.screenshot({ path: 'test-results/project-focused-inspector.png' })
})

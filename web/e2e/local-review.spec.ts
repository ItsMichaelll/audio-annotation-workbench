import { expect, test, type Page } from '@playwright/test'
import { Buffer } from 'node:buffer'

function syntheticAudio(): Buffer {
  const sampleRate = 48000
  const frames = sampleRate * 5
  const wav = Buffer.alloc(44 + frames * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(frames * 2, 40)
  for (let frame = 0; frame < frames; frame++) {
    wav.writeInt16LE(
      Math.round(Math.sin((frame * 2 * Math.PI * 1000) / sampleRate) * 3500),
      44 + frame * 2,
    )
  }
  return wav
}

async function loadStableAudio(page: Page) {
  await page.goto('/editor')
  await page
    .getByLabel('Select local audio file')
    .evaluate((element, encoded) => {
      if (!(element instanceof HTMLInputElement))
        throw new Error('Expected audio file input.')
      const binary = atob(encoded)
      const bytes = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0),
      )
      const transfer = new DataTransfer()
      transfer.items.add(
        new File([bytes], 'review-reference.wav', {
          type: 'audio/wav',
          lastModified: 1700000000000,
        }),
      )
      element.files = transfer.files
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }, syntheticAudio().toString('base64'))
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeEnabled()
}

test('local decisions, review history and feedback drafts survive source reload', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loadStableAudio(page)
  const review = page.getByRole('region', { name: 'Local review', exact: true })
  await expect(review.getByText('Saved locally', { exact: true })).toBeVisible()
  await review.getByLabel('Import local review proposals').setInputFiles({
    name: 'local-proposals.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        proposals: [
          {
            id: 'first',
            start: 0.5,
            end: 1,
            label: 'First passage',
            source: 'synthetic-review',
            score: 0.8,
          },
          {
            id: 'second',
            start: 2,
            end: 3,
            label: 'Second passage',
            source: 'synthetic-review',
            score: 0.6,
          },
        ],
      }),
    ),
  })
  await review
    .getByRole('button', { name: 'Next proposal', exact: true })
    .click()
  await review
    .getByRole('textbox', { name: 'Review notes', exact: true })
    .fill('Check the first passage again.')
  await review.getByRole('button', { name: 'Accept', exact: true }).click()
  await review
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('all')
  const firstRow = review.getByRole('row').filter({ hasText: 'First passage' })
  await expect(firstRow).toContainText('accepted')
  await review.getByRole('button', { name: 'Undo review', exact: true }).click()
  await expect(firstRow).toContainText('pending')
  await review.getByRole('button', { name: 'Redo review', exact: true }).click()
  await expect(firstRow).toContainText('accepted')
  await review.getByLabel('Feedback range start').fill('0.6')
  await review.getByLabel('Feedback range end').fill('1.2')
  await review
    .getByRole('button', { name: 'Save feedback evidence', exact: true })
    .click()
  await expect(
    review.getByText('2 proposals · 1 feedback ranges'),
  ).toBeVisible()
  await review
    .getByRole('button', { name: 'Next proposal', exact: true })
    .click()
  await review.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await expect(
    review.getByRole('row').filter({ hasText: 'Second passage' }),
  ).toContainText('dismissed')
  await expect(review.getByText('Saved locally', { exact: true })).toBeVisible()
  await page.reload()
  await loadStableAudio(page)
  await expect(
    review.getByText('2 proposals · 1 feedback ranges'),
  ).toBeVisible()
  await review
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('all')
  await expect(firstRow).toContainText('accepted')
  await firstRow.getByRole('button').click()
  await expect(
    review.getByRole('textbox', { name: 'Review notes', exact: true }),
  ).toHaveValue('Check the first passage again.')
  const downloadPromise = page.waitForEvent('download')
  await review
    .getByRole('button', { name: 'Export review', exact: true })
    .click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('local-audio-review.json')
  expect(errors).toEqual([])
})

test('speech-reference normalization measures local audio and keeps source inspection available', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loadStableAudio(page)
  const listening = page.getByRole('region', {
    name: 'Listening controls',
    exact: true,
  })
  await listening.getByLabel('Playback speed').selectOption('1.5')
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((audio) =>
          audio instanceof HTMLMediaElement ? audio.playbackRate : 0,
        ),
    )
    .toBe(1.5)
  await listening
    .getByRole('button', { name: 'Speech reference', exact: true })
    .click()
  await listening
    .getByRole('button', { name: 'Add range at playhead', exact: true })
    .click()
  await listening.getByLabel('End 1', { exact: true }).fill('3')
  await listening
    .getByRole('button', { name: 'Confirm reference', exact: true })
    .click()
  const normalize = listening.getByRole('button', {
    name: 'Normalized listening',
    exact: true,
  })
  await expect(normalize).toBeEnabled({ timeout: 20000 })
  await normalize.click()
  await expect(normalize).toHaveAttribute('aria-pressed', 'true')
  await expect(listening.getByText(/reference .* LUFS/)).toBeVisible()
  await page.getByRole('button', { name: 'Spectrum', exact: true }).click()
  await expect(
    page.getByRole('region', {
      name: 'Real-time spectrum analyzer',
      exact: true,
    }),
  ).toBeVisible()
  await normalize.click()
  await expect(normalize).toHaveAttribute('aria-pressed', 'false')
  await page.reload()
  await loadStableAudio(page)
  await expect(normalize).toBeEnabled({ timeout: 10000 })
  await expect(normalize).toHaveAttribute('aria-pressed', 'false')
  expect(errors).toEqual([])
})

test('offline loudness excludes flushing silence from 3 s and 400 ms selection scopes', async ({
  page,
}) => {
  await loadStableAudio(page)
  await page.getByRole('button', { name: 'Meter', exact: true }).click()
  const meter = page.getByRole('complementary', {
    name: 'Loudness and true-peak meter',
    exact: true,
  })
  const integrated = meter
    .locator('dl > div')
    .filter({ hasText: 'Integrated' })
    .locator('dd')
  await expect(integrated).toBeVisible({ timeout: 20000 })
  const fullFileLufs = Number.parseFloat(await integrated.innerText())
  const truePeak = meter
    .locator('dl > div')
    .filter({ hasText: 'True-peak max' })
    .locator('dd')
  expect(
    Math.abs(Number.parseFloat(await truePeak.innerText()) + 19.4),
  ).toBeLessThanOrEqual(0.21)
  // 1 kHz mono sine peak3500/32768 gives approximately -22.4 LUFS.
  expect(Math.abs(fullFileLufs + 22.4)).toBeLessThanOrEqual(0.21)
  await page
    .getByRole('button', { name: 'Create region at playhead', exact: true })
    .click()
  const regionEnd = page.getByRole('spinbutton', {
    name: 'End seconds',
    exact: true,
  })
  const regionStart = page.getByRole('spinbutton', {
    name: 'Start seconds',
    exact: true,
  })
  await regionEnd.fill('4')
  await regionEnd.press('Tab')
  await regionStart.fill('1')
  await regionStart.press('Tab')
  await meter.getByRole('button', { name: 'Selection', exact: true }).click()
  await expect
    .poll(async () =>
      Math.abs(Number.parseFloat(await integrated.innerText()) - fullFileLufs),
    )
    .toBeLessThanOrEqual(0.11)
  await regionEnd.fill('1.4')
  await regionEnd.press('Tab')
  const shortTermMaximum = meter
    .locator('dl > div')
    .filter({ hasText: 'Short-term max' })
    .locator('dd')
  await expect(shortTermMaximum).toContainText('—')
  await expect
    .poll(async () =>
      Math.abs(Number.parseFloat(await integrated.innerText()) - fullFileLufs),
    )
    .toBeLessThanOrEqual(0.11)
})

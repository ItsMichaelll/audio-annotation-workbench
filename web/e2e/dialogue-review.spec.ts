import { expect, test } from '@playwright/test'

test('paired fixture preserves decisions and listening position across A/B switches', async ({
  page,
}) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/editor/dialogue-review')
  await page.getByRole('button', { name: 'Load generated fixture' }).click()
  await expect(
    page.getByRole('region', { name: 'Speaker A', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Speaker B', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Adjustment (ms)').fill('25')
  await page.getByLabel('Review notes').fill('Generated fixture review')
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Accept', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Proposed', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Original', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Spectrum', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Spectrum Analyzer', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Meter', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Loudness Meter', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Speaker B', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Spectrum Analyzer', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Spectrogram', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Spectrogram', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('region', { name: 'Timing proposals', exact: true })
    .getByRole('button')
    .first()
    .click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(
    page.getByLabel('Loudness and true-peak meter').locator('output').first(),
  ).not.toContainText('∞')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(
    page
      .getByLabel('Loudness and true-peak meter')
      .getByText('Integrated', { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/dialogue-review-analysis.png',
    fullPage: true,
  })
  await page.reload()
  await expect(page.getByLabel('Adjustment (ms)')).toHaveValue('25')
  await expect(page.getByLabel('Review notes')).toHaveValue(
    'Generated fixture review',
  )
  await expect(
    page.getByRole('button', { name: 'Accept', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('link', { name: 'Standalone Editor', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Open audio', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

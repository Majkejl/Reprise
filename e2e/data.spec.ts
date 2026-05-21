// data.spec.ts — local import, export, and re-import round-trip E2E tests.

import { test, expect } from '@playwright/test'
import { clearAppData, importFixtureLesson, FIXTURE_LESSON } from './helpers'
import { Buffer } from 'buffer'

test.beforeEach(async ({ page }) => {
  await page.goto('/#/')
  await clearAppData(page)
  await page.reload()
})

test('local lesson import → lesson appears in lesson browser', async ({ page }) => {
  await importFixtureLesson(page)

  await page.goto('/#/lessons')
  await expect(page.getByText('E2E Fixture Lesson')).toBeVisible()
})

test('full export → re-import round-trip preserves lesson', async ({ page }) => {
  await importFixtureLesson(page)

  // Export full backup
  await page.goto('/#/settings')
  const downloadPromise = page.waitForEvent('download')
  // Button label includes description text in child spans, so match loosely
  await page.getByRole('button', { name: /full export/i }).click()
  const download = await downloadPromise
  const exportPath = await download.path()
  expect(exportPath).toBeTruthy()

  // Clear data and re-import the backup
  await clearAppData(page)
  await page.reload()
  await page.goto('/#/settings')

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /choose backup file/i }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(exportPath!)
  await page.getByText(/import complete/i).waitFor({ timeout: 5000 })

  // Lesson is back in the browser
  await page.goto('/#/lessons')
  await expect(page.getByText('E2E Fixture Lesson')).toBeVisible()
})

test('source sync — registers a source and reflects it in sources list', async ({ page }) => {
  // Mock a minimal source endpoint so sync does not require a live URL.
  const sourceIndex = { lessons: [] }
  await page.route('**/mock-source/index.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sourceIndex) }),
  )

  await page.goto('/#/sources')
  await page.getByPlaceholder(/https:\/\//i).fill('http://localhost/mock-source/')
  await page.getByRole('button', { name: /add source/i }).click()

  // The new source label (derived from hostname) appears in the list
  await expect(page.getByText('localhost', { exact: true })).toBeVisible({ timeout: 5000 })
})

test('local lesson import — importing same lesson twice does not duplicate it', async ({ page }) => {
  await importFixtureLesson(page)
  await importFixtureLesson(page) // import again

  await page.goto('/#/lessons')
  // Only one entry for the fixture lesson
  const entries = page.getByText('E2E Fixture Lesson')
  await expect(entries).toHaveCount(1)
})

test('local import rejects invalid JSON', async ({ page }) => {
  await page.goto('/#/settings')
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /choose lesson file/i }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('not valid json'),
  })
  // Global error notification should appear
  await expect(page.locator('[role="status"], .text-red-300').first()).toBeVisible({ timeout: 5000 })
})

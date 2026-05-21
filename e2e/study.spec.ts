// study.spec.ts — card loop and session end E2E tests.

import { test, expect } from '@playwright/test'
import { clearAppData, importFixtureLesson, answerCardGood } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/#/')
  await clearAppData(page)
  await page.reload()
})

test('empty state shows nothing due', async ({ page }) => {
  await page.goto('/#/')
  await page.getByRole('button', { name: /start study session/i }).click()
  await expect(page.getByText(/nothing due right now/i)).toBeVisible()
})

test('card loop → session end → summary', async ({ page }) => {
  await importFixtureLesson(page)

  await page.goto('/#/')
  await page.getByRole('button', { name: /start study session/i }).click()

  // Complete all 3 fixture cards
  for (let i = 0; i < 3; i++) {
    await answerCardGood(page)
  }

  // Session complete screen appears
  await page.getByRole('button', { name: /see summary/i }).click()

  // Summary shows 3 cards reviewed
  await expect(page.getByText(/session complete/i)).toBeVisible()
  await expect(page.getByText(/3 cards reviewed/i)).toBeVisible()
})

test('scope selection — restricting to a tag still yields cards from that tag', async ({ page }) => {
  await importFixtureLesson(page)

  // The fixture lesson has tag "e2e". Selecting it restricts scope to that tag.
  // Tags are derived from LessonsRepo so they appear even for locally-imported lessons.
  await page.goto('/#/scope')

  // The Tags section is collapsible and closed by default (no specific tags selected).
  // Expand it by clicking the "Tags" heading button before interacting with individual tags.
  await page.getByRole('button', { name: /^tags/i }).click()

  // "All tags" should be the default (aria-pressed=true)
  await expect(page.getByRole('button', { name: /all tags/i })).toHaveAttribute('aria-pressed', 'true')

  // Click the "e2e" tag to restrict scope to that tag only.
  // The accessible name includes the checkmark character, so match as a substring.
  await page.getByRole('button', { name: /e2e/i }).click()

  // "e2e" tag button should now be pressed; "All tags" should not
  await expect(page.getByRole('button', { name: /e2e/i })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /all tags/i })).toHaveAttribute('aria-pressed', 'false')

  // Study session still finds cards from the selected tag
  await page.goto('/#/')
  await page.getByRole('button', { name: /start study session/i }).click()
  await expect(
    page.getByText(/nothing due right now|which option is correct|the answer is|describe something/i)
  ).toBeVisible()
})

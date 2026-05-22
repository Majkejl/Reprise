// tutorial.spec.ts — bundled tutorial seeding, study inclusion, and dismissal E2E tests.

import { test, expect } from '@playwright/test'
import { clearAppData, waitForLessonsSeeded } from './helpers'

// Distinctive substrings from each tutorial card question/prompt (see public/tutorial-lesson.json).
// Used to assert the tutorial is being served in a study session regardless of queue order.
const TUTORIAL_CARD_TEXT = /rating control|nothing is uploaded|free-text card/i

test.beforeEach(async ({ page }) => {
  // Start clean, then reload so App startup re-seeds the tutorial into a fresh DB.
  await page.goto('/#/')
  await clearAppData(page)
  await page.reload()
  // Seeding is async; wait for it to land before touching views that snapshot the DB on mount.
  await waitForLessonsSeeded(page)
})

test('tutorial lesson is present in the lesson browser on first launch (no sync)', async ({ page }) => {
  await page.goto('/#/lessons')
  await expect(page.getByText('Welcome to Reprise')).toBeVisible({ timeout: 10000 })
})

test('tutorial cards appear in the default study session before dismissal', async ({ page }) => {
  await page.goto('/#/')
  await page.getByRole('button', { name: /start study session/i }).click()
  await expect(page.getByText(TUTORIAL_CARD_TEXT)).toBeVisible({ timeout: 10000 })
})

test('dismissing the tutorial removes it from study sessions and persists across reload', async ({ page }) => {
  // Open the tutorial from the browser (guarantees it is seeded before we reach the reader).
  await page.goto('/#/lessons')
  await page.getByText('Welcome to Reprise').click()

  await page.getByRole('button', { name: /dismiss tutorial/i }).click()

  // Back on the lessons list; the lesson row is dismissed, not deleted.
  await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible()
  await expect(page.getByText('Welcome to Reprise')).toBeVisible()

  // Simulate a relaunch: the dismissed flag persists and the tutorial is not re-seeded.
  await page.reload()

  // The tutorial no longer enters the global study session.
  await page.goto('/#/')
  await page.getByRole('button', { name: /start study session/i }).click()
  await expect(page.getByText(/nothing due right now/i)).toBeVisible({ timeout: 10000 })

  // ...but it is still openable from the browser (dismiss does not delete it).
  await page.goto('/#/lessons')
  await expect(page.getByText('Welcome to Reprise')).toBeVisible()
})

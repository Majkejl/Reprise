// helpers.ts — shared fixture data and setup utilities for E2E tests.

import type { Page } from '@playwright/test'
import { Buffer } from 'buffer'

/** Minimal lesson used as fixture data. Three cards, one of each type. */
export const FIXTURE_LESSON = JSON.stringify({
  lessonId: 'e2e-fixture-01',
  version: 1,
  title: 'E2E Fixture Lesson',
  tags: ['e2e'],
  creator: 'e2e-tests',
  cards: [
    {
      cardId: 'e2e-mc-01',
      type: 'multiple-choice',
      question: 'Which option is correct?',
      options: ['Wrong A', 'Correct B', 'Wrong C'],
      correctIndex: 1,
      explanation: 'Option B is correct.',
    },
    {
      cardId: 'e2e-fib-01',
      type: 'fill-in-blank',
      prompt: 'The answer is ___.',
      acceptedAnswers: ['yes'],
      explanation: 'Fill with "yes".',
    },
    {
      cardId: 'e2e-ft-01',
      type: 'free-text',
      question: 'Describe something.',
      explanation: 'Model answer here.',
    },
  ],
})

/** Resets the app's IndexedDB to a clean state between tests. */
export async function clearAppData(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('reprise')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve() // resolve anyway; deletion happens on next open
    })
  })
}

/** Imports the fixture lesson via the Settings UI file picker. */
export async function importFixtureLesson(page: Page): Promise<void> {
  await page.goto('/#/settings')
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /choose lesson file/i }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(FIXTURE_LESSON),
  })
  await page.getByText(/lesson imported/i).waitFor({ timeout: 5000 })
}

/**
 * Answers the current card and submits a "Good" (3) rating.
 * Handles all three built-in card types.
 */
export async function answerCardGood(page: Page): Promise<void> {
  const mcFirst = page.locator('ul > li > button').first()
  const fibInput = page.getByLabel('Your answer')
  const showAnswer = page.getByRole('button', { name: /show answer/i })

  // Wait for any pre-answer control to appear (avoids sequential timeouts per card type).
  // or() creates a union locator — resolves as soon as any one element is visible.
  await mcFirst.or(fibInput).or(showAnswer).waitFor({ state: 'visible', timeout: 10000 })

  // Re-evaluate visibility in parallel to avoid the race where the union waitFor resolves
  // on one element but it disappears before the isVisible() call below.
  const [isMC, isFIB] = await Promise.all([mcFirst.isVisible(), fibInput.isVisible()])

  if (isMC) {
    await mcFirst.click()
  } else if (isFIB) {
    await fibInput.fill('yes')
    await page.getByRole('button', { name: /^check$/i }).click()
  } else {
    // Free-text card: wait explicitly for showAnswer in case it is mid-render.
    await showAnswer.waitFor({ state: 'visible', timeout: 5000 })
    await showAnswer.click()
  }

  // Wait for the Good button to appear (reveal complete), click it, then wait for it
  // to disappear (card transition) before returning — prevents reading stale state next call.
  const goodButton = page.getByRole('button', { name: /good/i })
  await goodButton.waitFor({ timeout: 5000 })
  await goodButton.click()
  await goodButton.waitFor({ state: 'hidden', timeout: 5000 })
}

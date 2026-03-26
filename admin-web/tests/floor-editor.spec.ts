import { test, expect } from '@playwright/test';

test.describe('Éditeur de salle', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    const floorLink = page.locator('a[href*="/floor/"]').first();
    const hasLink = await floorLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasLink) {
      await floorLink.click();
    } else {
      await page.goto('/floor/1');
    }
  });

  test('affiche le titre Éditeur de salle', async ({ page }) => {
    await expect(page.getByText(/Éditeur de salle/)).toBeVisible({ timeout: 5000 });
  });

  test('affiche le bouton Ajouter table', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Ajouter table/ })).toBeVisible();
  });

  test('affiche le bouton Sauvegarder', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Sauvegarder/ })).toBeVisible();
  });

  test('affiche la grille de tables', async ({ page }) => {
    await expect(page.locator('.grid-container')).toBeVisible();
  });

  test('le bouton Sauvegarder est désactivé si aucune modification', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: /Sauvegarder/ });
    await expect(saveBtn).toBeDisabled();
  });

});

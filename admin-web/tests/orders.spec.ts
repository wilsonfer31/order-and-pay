import { test, expect } from '@playwright/test';

test.describe('Historique des commandes', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/orders');
  });

  test('affiche le titre Historique des commandes', async ({ page }) => {
    await expect(page.getByText('Historique des commandes')).toBeVisible();
  });

  test('affiche les filtres de dates', async ({ page }) => {
    await expect(page.getByLabel('Du')).toBeVisible();
    await expect(page.getByLabel('Au')).toBeVisible();
  });

  test('affiche les boutons Rechercher et Réinitialiser', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Rechercher/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réinitialiser' })).toBeVisible();
  });

  test('affiche le message d\'aide initial', async ({ page }) => {
    await expect(page.getByText('Sélectionnez une plage de dates et cliquez sur Rechercher.')).toBeVisible();
  });

  test('recherche avec une plage de dates et affiche des résultats ou message vide', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await page.getByLabel('Du').fill(monthAgo);
    await page.getByLabel('Au').fill(today);
    await page.getByRole('button', { name: /Rechercher/ }).click();

    await expect(page.locator('.state-msg').or(page.locator('.orders-list')).or(page.locator('.kpis')).first()).toBeVisible({ timeout: 10000 });
  });

  test('le bouton Exporter CSV apparaît si des résultats existent', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await page.getByLabel('Du').fill(monthAgo);
    await page.getByLabel('Au').fill(today);
    await page.getByRole('button', { name: /Rechercher/ }).click();

    const hasOrders = await page.locator('.orders-list').isVisible().catch(() => false);
    if (hasOrders) {
      await expect(page.getByRole('button', { name: /Exporter CSV/ })).toBeVisible();
    }
  });

});

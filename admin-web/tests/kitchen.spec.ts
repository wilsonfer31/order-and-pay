import { test, expect } from '@playwright/test';

test.describe('Vue Cuisine', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/kitchen');
  });

  test('affiche le titre Vue cuisine', async ({ page }) => {
    await expect(page.getByText('Vue cuisine')).toBeVisible();
  });

  test('affiche les 3 colonnes kanban', async ({ page }) => {
    await expect(page.locator('.col__header--new')).toBeVisible();
    await expect(page.locator('.col__header--progress')).toBeVisible();
    await expect(page.locator('.col__header--ready')).toBeVisible();
  });

  test('affiche le statut de connexion WebSocket', async ({ page }) => {
    const wsLabel = page.locator('.ws-label');
    await expect(wsLabel).toBeVisible();
    await expect(wsLabel).toContainText(/Temps réel|Déconnecté/);
  });

  test('affiche les états vides si aucun ticket', async ({ page }) => {
    const pending = page.locator('.col__empty').first();
    // Si pas de commandes, les colonnes vides s'affichent
    const hasEmptyOrTickets =
      await pending.isVisible().catch(() => false) ||
      await page.locator('.card').first().isVisible().catch(() => false);
    expect(hasEmptyOrTickets).toBeTruthy();
  });

  test('affiche l\'heure courante', async ({ page }) => {
    await expect(page.locator('.kitchen-clock')).toBeVisible();
  });

});

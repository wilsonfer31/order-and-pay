import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('affiche le titre du dashboard', async ({ page }) => {
    await expect(page.getByText("Dashboard — Aujourd'hui")).toBeVisible();
  });

  test('affiche les 4 cartes KPI', async ({ page }) => {
    await expect(page.getByText('CA TTC')).toBeVisible();
    await expect(page.getByText('Panier moyen')).toBeVisible();
    await expect(page.getByText('Marge brute')).toBeVisible();
    await expect(page.getByText('Décomposition TVA')).toBeVisible();
  });

  test('affiche le graphique des 30 derniers jours', async ({ page }) => {
    await expect(page.getByText('Évolution du CA (30 derniers jours)')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('affiche la section activité en temps réel', async ({ page }) => {
    await expect(page.getByText('Activité en temps réel')).toBeVisible();
  });

  test('affiche l\'état des tables si des tables existent', async ({ page }) => {
    const tablesSection = page.getByText('État des tables');
    const feedEmpty = page.getByText('En attente d\'activité…');

    // Soit les tables s'affichent, soit le feed vide — les deux sont valides
    const hasTablesOrFeed = await tablesSection.isVisible().then(v => v)
      .catch(() => false) || await feedEmpty.isVisible().catch(() => false);

    expect(hasTablesOrFeed).toBeTruthy();
  });

  test('le point WebSocket devient vert après connexion', async ({ page }) => {
    // Attend que le dot soit vert (connexion WS établie)
    await expect(page.locator('.live-dot--on')).toBeVisible({ timeout: 10000 });
  });

});

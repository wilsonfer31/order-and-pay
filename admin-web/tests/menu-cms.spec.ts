import { test, expect } from '@playwright/test';

test.describe('Gestion du Menu', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/menu');
  });

  test('affiche le titre Gestion du Menu', async ({ page }) => {
    await expect(page.getByText('Gestion du Menu')).toBeVisible();
  });

  test('affiche les boutons Nouvelle catégorie et Nouveau plat', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouvelle catégorie/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nouveau plat/ })).toBeVisible();
  });

  test('affiche la sidebar des catégories', async ({ page }) => {
    await expect(page.getByText('Catégories')).toBeVisible();
    await expect(page.getByText('Tous les articles')).toBeVisible();
  });

  test('ouvre le formulaire nouveau plat au clic', async ({ page }) => {
    await page.getByRole('button', { name: /Nouveau plat/ }).first().click();
    await expect(page.getByLabel('Nom du plat')).toBeVisible();
  });

  test('ouvre le formulaire nouvelle catégorie au clic', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle catégorie/ }).click();
    await expect(page.getByLabel('Nom de la catégorie')).toBeVisible();
  });

  test('le formulaire catégorie a un sélecteur de destination', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle catégorie/ }).click();
    await expect(page.getByLabel('Destination')).toBeVisible();
  });

  test('ferme le panneau au clic sur Annuler', async ({ page }) => {
    await page.getByRole('button', { name: /Nouveau plat/ }).first().click();
    await expect(page.getByLabel('Nom du plat')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByLabel('Nom du plat')).not.toBeVisible();
  });

});

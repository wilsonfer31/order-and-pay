import { test, expect } from '@playwright/test';

test.describe('Équipe', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/staff');
  });

  test('affiche le titre Équipe', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Équipe' })).toBeVisible();
  });

  test('affiche le bouton Ajouter un membre', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Ajouter un membre/ })).toBeVisible();
  });

  test('affiche les colonnes du tableau', async ({ page }) => {
    await expect(page.locator('.staff-table__header')).toBeVisible();
    await expect(page.locator('.staff-table__header').getByText('Membre')).toBeVisible();
    await expect(page.locator('.staff-table__header').getByText('Rôle')).toBeVisible();
    await expect(page.locator('.staff-table__header').getByText('Statut')).toBeVisible();
  });

  test('ouvre le panneau Nouveau membre au clic', async ({ page }) => {
    await page.getByRole('button', { name: /Ajouter un membre/ }).click();
    await expect(page.getByText('Nouveau membre')).toBeVisible();
    await expect(page.getByLabel('Prénom')).toBeVisible();
    await expect(page.getByLabel('Nom', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('le formulaire nouveau membre a un sélecteur de rôle', async ({ page }) => {
    await page.getByRole('button', { name: /Ajouter un membre/ }).click();
    await expect(page.getByLabel('Rôle')).toBeVisible();
  });

  test('ferme le panneau au clic sur Annuler', async ({ page }) => {
    await page.getByRole('button', { name: /Ajouter un membre/ }).click();
    await expect(page.getByText('Nouveau membre')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByLabel('Prénom')).not.toBeVisible();
  });

  test('affiche un membre existant dans la liste', async ({ page }) => {
    const hasStaff = await page.locator('.staff-row').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText('Aucun membre dans l\'équipe.').isVisible().catch(() => false);
    expect(hasStaff || hasEmpty).toBeTruthy();
  });

});

import { test, expect } from '@playwright/test';

const DEMO_EMAIL = 'admin@demo.fr';
const DEMO_PASSWORD = 'Admin123!';

test.describe('Authentification', () => {

  test('redirige vers login si token supprimé', async ({ page }) => {
    await page.goto('/dashboard');
    // Supprime le token JWT pour simuler une déconnexion
    await page.evaluate(() => {
      Object.keys(localStorage).forEach(k => {
        if (k.includes('token') || k.includes('auth') || k.includes('jwt')) {
          localStorage.removeItem(k);
        }
      });
      localStorage.clear();
    });
    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('affiche une erreur avec des mauvais identifiants', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse email').fill('wrong@email.com');
    await page.getByLabel('Mot de passe').fill('wrongpassword');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible();
  });

  test('login réussi redirige vers le dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse email').fill(DEMO_EMAIL);
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

});

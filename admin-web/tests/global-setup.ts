import { chromium } from '@playwright/test';

export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:4201/login');
  await page.getByLabel('Adresse email').fill('admin@demo.fr');
  await page.getByLabel('Mot de passe').fill('Admin123!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });

  await page.context().storageState({ path: 'tests/.auth-state.json' });
  await browser.close();
}

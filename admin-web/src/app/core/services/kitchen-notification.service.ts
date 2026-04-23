import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class KitchenNotificationService {
  private swReg: ServiceWorkerRegistration | null = null;

  get permission(): NotificationPermission {
    return 'Notification' in window ? Notification.permission : 'denied';
  }

  get supported(): boolean {
    return 'Notification' in window;
  }

  /** Demande la permission et enregistre le Service Worker. */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.supported) return 'denied';

    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return result;
    }

    await this.registerSW();
    return 'granted';
  }

  private async registerSW(): Promise<void> {
    if (!('serviceWorker' in navigator) || this.swReg) return;
    try {
      this.swReg = await navigator.serviceWorker.register('/push.worker.js', { scope: '/' });
    } catch {
      // Pas de SW : on utilisera new Notification() en fallback
    }
  }

  /**
   * Affiche une notification système.
   * Si le SW est disponible → showNotification (fonctionne même onglet en arrière-plan).
   * Sinon → Notification API directe.
   */
  async notify(tableLabel: string, lines?: { name: string; quantity: number }[]): Promise<void> {
    if (!this.supported || Notification.permission !== 'granted') return;

    const title = `Nouvelle commande — ${tableLabel}`;
    const body  = lines?.map(l => `${l.quantity}× ${l.name}`).join('\n') ?? '';
    const opts: NotificationOptions = {
      body,
      icon:              '/favicon.ico',
      badge:             '/favicon.ico',
      tag:               'kitchen-new-order',
      requireInteraction: false,
    };

    if (this.swReg) {
      await this.swReg.showNotification(title, opts);
    } else {
      new Notification(title, opts);
    }
  }
}

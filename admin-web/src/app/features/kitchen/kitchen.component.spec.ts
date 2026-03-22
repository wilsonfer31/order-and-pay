import { TestBed, fakeAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EMPTY } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { KitchenComponent } from './kitchen.component';
import { WebSocketService } from '../../core/services/websocket.service';
import { AuthService } from '../../core/services/auth.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

// Timestamp de référence fixe pour rendre les tests déterministes.
// On le set sur comp.now avant chaque test de timing.
const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z').getTime();

function isoMinutesAgo(minutes: number): string {
  return new Date(FIXED_NOW - minutes * 60_000).toISOString();
}

function makeOrder(overrides: Partial<{
  orderId: string; orderNumber: number; tableLabel: string;
  status: string; totalTtc: number; confirmedAt: string | null;
  lines: any[];
}> = {}): any {
  return {
    orderId: 'o1', orderNumber: 1, tableLabel: 'T1',
    status: 'CONFIRMED', totalTtc: 10, confirmedAt: isoMinutesAgo(0),
    lines: [],
    ...overrides,
  };
}

function makeLine(overrides: Partial<{
  id: string; productName: string; quantity: number;
  status: string; notes?: string;
}> = {}): any {
  return { id: 'l1', productName: 'Burger', quantity: 2, status: 'PENDING', ...overrides };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('KitchenComponent', () => {
  let comp: KitchenComponent;
  let httpMock: HttpTestingController;

  const mockWs = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected$: EMPTY,
    kitchenEvents$: jest.fn(() => EMPTY),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KitchenComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WebSocketService, useValue: mockWs },
        { provide: AuthService, useValue: { getRestaurantId: () => 'resto-1' } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    const fixture = TestBed.createComponent(KitchenComponent);
    comp = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    // Déclenche ngOnInit et flush la requête HTTP initiale
    fixture.detectChanges();
    httpMock.expectOne('/orders').flush([]);

    // Fige l'horloge interne du composant pour des tests déterministes
    comp.now.set(FIXED_NOW);
  });

  afterEach(() => httpMock.verify());

  // ── formatTime ─────────────────────────────────────────────────────────────

  describe('formatTime()', () => {
    it('retourne "--:--" si null', () => {
      expect(comp.formatTime(null)).toBe('--:--');
    });

    it('retourne une heure au format HH:MM pour un ISO valide', () => {
      expect(comp.formatTime('2024-06-15T12:30:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  // ── elapsed ────────────────────────────────────────────────────────────────

  describe('elapsed()', () => {
    it('retourne "" si null', () => {
      expect(comp.elapsed(null)).toBe('');
    });

    it('retourne "à l\'instant" si < 1 minute', () => {
      expect(comp.elapsed(isoMinutesAgo(0))).toBe("à l'instant");
    });

    it('retourne "5 min" à 5 minutes', () => {
      expect(comp.elapsed(isoMinutesAgo(5))).toBe('5 min');
    });

    it('retourne "1h30" à 90 minutes', () => {
      expect(comp.elapsed(isoMinutesAgo(90))).toBe('1h30');
    });

    it('retourne "2h" à exactement 120 minutes (sans minutes restantes)', () => {
      expect(comp.elapsed(isoMinutesAgo(120))).toBe('2h');
    });
  });

  // ── urgencyClass ───────────────────────────────────────────────────────────

  describe('urgencyClass()', () => {
    it('retourne "ok" si null', () => {
      expect(comp.urgencyClass(null)).toBe('ok');
    });

    it('retourne "ok" si < 7 minutes', () => {
      expect(comp.urgencyClass(isoMinutesAgo(5))).toBe('ok');
    });

    it('retourne "warn" à exactement 7 minutes', () => {
      expect(comp.urgencyClass(isoMinutesAgo(7))).toBe('warn');
    });

    it('retourne "warn" entre 7 et 15 minutes', () => {
      expect(comp.urgencyClass(isoMinutesAgo(12))).toBe('warn');
    });

    it('retourne "danger" à exactement 15 minutes', () => {
      expect(comp.urgencyClass(isoMinutesAgo(15))).toBe('danger');
    });

    it('retourne "danger" au-delà de 15 minutes', () => {
      expect(comp.urgencyClass(isoMinutesAgo(30))).toBe('danger');
    });
  });

  // ── Computed signals (pendingTickets / cookingTickets / readyTickets) ───────

  describe('computed tickets par statut', () => {
    it('retourne des listes vides quand il n\'y a pas de commandes', () => {
      expect(comp.pendingTickets()).toEqual([]);
      expect(comp.cookingTickets()).toEqual([]);
      expect(comp.readyTickets()).toEqual([]);
    });

    it('distribue les lignes dans le bon kanban selon leur statut', () => {
      comp.orders.set([makeOrder({
        lines: [
          makeLine({ id: 'l1', status: 'PENDING' }),
          makeLine({ id: 'l2', status: 'COOKING' }),
          makeLine({ id: 'l3', status: 'READY' }),
          makeLine({ id: 'l4', status: 'SERVED' }),
        ],
      })]);

      expect(comp.pendingTickets().map(t => t.lineId)).toEqual(['l1']);
      expect(comp.cookingTickets().map(t => t.lineId)).toEqual(['l2']);
      expect(comp.readyTickets().map(t => t.lineId)).toEqual(['l3']);
    });

    it('exclut les lignes SERVED de toutes les colonnes', () => {
      comp.orders.set([makeOrder({ lines: [makeLine({ status: 'SERVED' })] })]);

      expect(comp.pendingTickets()).toHaveLength(0);
      expect(comp.cookingTickets()).toHaveLength(0);
      expect(comp.readyTickets()).toHaveLength(0);
    });

    it('reporte correctement orderId, tableLabel, productName et quantity sur chaque ticket', () => {
      comp.orders.set([makeOrder({
        orderId: 'o-99', tableLabel: 'Terrasse 3',
        lines: [makeLine({ id: 'l1', productName: 'Entrecôte', quantity: 3 })],
      })]);

      const ticket = comp.pendingTickets()[0];
      expect(ticket.orderId).toBe('o-99');
      expect(ticket.tableLabel).toBe('Terrasse 3');
      expect(ticket.productName).toBe('Entrecôte');
      expect(ticket.quantity).toBe(3);
    });

    it('agrège les lignes de plusieurs commandes', () => {
      comp.orders.set([
        makeOrder({ orderId: 'o1', lines: [makeLine({ id: 'l1', status: 'PENDING' })] }),
        makeOrder({ orderId: 'o2', lines: [makeLine({ id: 'l2', status: 'PENDING' })] }),
      ]);

      expect(comp.pendingTickets()).toHaveLength(2);
    });
  });

  // ── applyEvent ─────────────────────────────────────────────────────────────

  describe('applyEvent()', () => {
    const o1 = makeOrder({ orderId: 'o1', lines: [makeLine()] });
    const o2 = makeOrder({ orderId: 'o2', lines: [makeLine()] });

    it('ORDER_CREATED recharge la liste via HTTP', fakeAsync(() => {
      comp.orders.set([o1]);
      (comp as any)['applyEvent']({ eventType: 'ORDER_CREATED' });

      const req = httpMock.expectOne('/orders');
      req.flush([o1, o2]);
      expect(comp.orders()).toHaveLength(2);
    }));

    it('ORDER_STATUS_CHANGED DELIVERED supprime la commande', () => {
      comp.orders.set([o1, o2]);
      (comp as any)['applyEvent']({ eventType: 'ORDER_STATUS_CHANGED', orderId: 'o1', orderStatus: 'DELIVERED' });

      expect(comp.orders().map(o => o.orderId)).toEqual(['o2']);
    });

    it('ORDER_STATUS_CHANGED CANCELLED supprime la commande', () => {
      comp.orders.set([o1, o2]);
      (comp as any)['applyEvent']({ eventType: 'ORDER_STATUS_CHANGED', orderId: 'o1', orderStatus: 'CANCELLED' });

      expect(comp.orders().map(o => o.orderId)).toEqual(['o2']);
    });

    it('ORDER_STATUS_CHANGED PAID supprime la commande', () => {
      comp.orders.set([o1, o2]);
      (comp as any)['applyEvent']({ eventType: 'ORDER_STATUS_CHANGED', orderId: 'o2', orderStatus: 'PAID' });

      expect(comp.orders().map(o => o.orderId)).toEqual(['o1']);
    });

    it('ORDER_STATUS_CHANGED non-terminal met à jour le statut de la commande', () => {
      comp.orders.set([o1]);
      (comp as any)['applyEvent']({ eventType: 'ORDER_STATUS_CHANGED', orderId: 'o1', orderStatus: 'IN_PROGRESS' });

      expect(comp.orders()[0].status).toBe('IN_PROGRESS');
    });

    it('ORDER_STATUS_CHANGED ne touche pas les autres commandes', () => {
      comp.orders.set([o1, o2]);
      (comp as any)['applyEvent']({ eventType: 'ORDER_STATUS_CHANGED', orderId: 'o1', orderStatus: 'READY' });

      expect(comp.orders()[1].status).toBe('CONFIRMED'); // o2 inchangé
    });

    it('LINE_STATUS_CHANGED met à jour le statut de la ligne ciblée', () => {
      comp.orders.set([makeOrder({ orderId: 'o1', lines: [makeLine({ id: 'l1', status: 'PENDING' })] })]);
      (comp as any)['applyEvent']({ eventType: 'LINE_STATUS_CHANGED', orderId: 'o1', lineId: 'l1', lineStatus: 'COOKING' });

      expect(comp.orders()[0].lines[0].status).toBe('COOKING');
    });

    it('LINE_STATUS_CHANGED passe la commande en READY quand toutes les lignes actives sont prêtes', () => {
      comp.orders.set([makeOrder({
        orderId: 'o1', status: 'IN_PROGRESS',
        lines: [
          makeLine({ id: 'l1', status: 'READY' }),
          makeLine({ id: 'l2', status: 'COOKING' }),
        ],
      })]);
      (comp as any)['applyEvent']({ eventType: 'LINE_STATUS_CHANGED', orderId: 'o1', lineId: 'l2', lineStatus: 'READY' });

      expect(comp.orders()[0].status).toBe('READY');
    });

    it('LINE_STATUS_CHANGED ne touche pas les autres commandes', () => {
      comp.orders.set([
        o1,
        makeOrder({ orderId: 'o2', lines: [makeLine({ id: 'l99', status: 'PENDING' })] }),
      ]);
      (comp as any)['applyEvent']({ eventType: 'LINE_STATUS_CHANGED', orderId: 'o2', lineId: 'l99', lineStatus: 'COOKING' });

      expect(comp.orders()[0].lines[0].status).toBe('PENDING'); // o1 inchangé
      expect(comp.orders()[1].lines[0].status).toBe('COOKING');
    });

    it('ignore les événements d\'un type inconnu', () => {
      comp.orders.set([o1]);
      expect(() => {
        (comp as any)['applyEvent']({ eventType: 'UNKNOWN_EVENT', orderId: 'o1' });
      }).not.toThrow();
      expect(comp.orders()).toHaveLength(1);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { EMPTY } from 'rxjs';

import { OrderTrackingPage, OrderState } from './order-tracking.page';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderState> = {}): OrderState {
  return {
    orderId: 'order-1',
    tableLabel: 'T1',
    status: 'CONFIRMED',
    lines: [],
    totalTtc: 25.5,
    ...overrides,
  };
}

function makeLine(overrides: Partial<OrderState['lines'][0]> = {}): OrderState['lines'][0] {
  return { id: 'l1', productName: 'Burger', quantity: 1, status: 'PENDING', ...overrides };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OrderTrackingPage', () => {
  let comp: OrderTrackingPage;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrderTrackingPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: { orderId: 'order-1' } } },
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    const fixture = TestBed.createComponent(OrderTrackingPage);
    comp = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    // Stoppe la connexion WebSocket réelle pour rester dans jsdom
    const stomp = (comp as any)['stomp'];
    jest.spyOn(stomp, 'configure').mockImplementation(() => {});
    jest.spyOn(stomp, 'activate').mockImplementation(() => {});
    jest.spyOn(stomp, 'deactivate').mockImplementation(() => {});
    jest.spyOn(stomp, 'watch').mockReturnValue(EMPTY);
    Object.defineProperty(stomp, 'connectionState$', { get: () => EMPTY });

    // Déclenche ngOnInit et flush la requête HTTP initiale
    fixture.detectChanges();
    httpMock.expectOne('/public/orders/order-1').flush(makeOrder());
  });

  afterEach(() => httpMock.verify());

  // ── statusMessage ──────────────────────────────────────────────────────────

  describe('statusMessage()', () => {
    it('retourne "" si order est null', () => {
      comp.order.set(null);
      expect(comp.statusMessage()).toBe('');
    });

    it.each([
      ['CONFIRMED',   'Votre commande est confirmée ✅'],
      ['IN_PROGRESS', 'La cuisine prépare vos plats... 👨‍🍳'],
      ['READY',       "C'est prêt ! Votre serveur arrive 🍽️"],
      ['DELIVERED',   'Bon appétit ! 🎉'],
      ['CANCELLED',   'Commande annulée.'],
    ] as const)('retourne le bon message pour le statut %s', (status, expected) => {
      comp.order.set(makeOrder({ status }));
      expect(comp.statusMessage()).toBe(expected);
    });
  });

  // ── stepIndex ──────────────────────────────────────────────────────────────

  describe('stepIndex()', () => {
    it('retourne 0 si order est null', () => {
      comp.order.set(null);
      expect(comp.stepIndex()).toBe(0);
    });

    it.each([
      ['CONFIRMED',   0],
      ['IN_PROGRESS', 1],
      ['READY',       2],
      ['DELIVERED',   3],
    ] as const)('%s → index %s', (status, expected) => {
      comp.order.set(makeOrder({ status }));
      expect(comp.stepIndex()).toBe(expected);
    });

    it('retourne -1 pour CANCELLED (hors des étapes)', () => {
      comp.order.set(makeOrder({ status: 'CANCELLED' }));
      expect(comp.stepIndex()).toBe(-1);
    });
  });

  // ── formatTime ────────────────────────────────────────────────────────────

  describe('formatTime()', () => {
    it('retourne une heure au format HH:MM pour un ISO valide', () => {
      expect(comp.formatTime('2024-06-15T12:30:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  // ── applyEvent ─────────────────────────────────────────────────────────────

  describe('applyEvent()', () => {
    it('ORDER_STATUS_CHANGED met à jour le statut de la commande', () => {
      comp.order.set(makeOrder({ status: 'CONFIRMED' }));
      (comp as any)['applyEvent']({ eventType: 'ORDER_STATUS_CHANGED', orderId: 'order-1', orderStatus: 'IN_PROGRESS' });

      expect(comp.order()?.status).toBe('IN_PROGRESS');
    });

    it('ORDER_STATUS_CHANGED CANCELLED appelle stomp.deactivate()', () => {
      const deactivateSpy = jest.spyOn((comp as any)['stomp'], 'deactivate');
      comp.order.set(makeOrder());
      (comp as any)['applyEvent']({ eventType: 'ORDER_STATUS_CHANGED', orderId: 'order-1', orderStatus: 'CANCELLED' });

      expect(comp.order()?.status).toBe('CANCELLED');
      expect(deactivateSpy).toHaveBeenCalled();
    });

    it('ORDER_STATUS_CHANGED crée la commande si order est null', () => {
      comp.order.set(null);
      (comp as any)['applyEvent']({ eventType: 'ORDER_STATUS_CHANGED', orderId: 'new-order', orderStatus: 'IN_PROGRESS' });

      expect(comp.order()?.orderId).toBe('new-order');
      expect(comp.order()?.status).toBe('IN_PROGRESS');
    });

    it('LINE_STATUS_CHANGED met à jour uniquement la ligne ciblée', () => {
      comp.order.set(makeOrder({
        lines: [
          makeLine({ id: 'l1', status: 'PENDING' }),
          makeLine({ id: 'l2', status: 'PENDING' }),
        ],
      }));
      (comp as any)['applyEvent']({ eventType: 'LINE_STATUS_CHANGED', lineId: 'l1', lineStatus: 'COOKING' });

      expect(comp.order()?.lines[0].status).toBe('COOKING');
      expect(comp.order()?.lines[1].status).toBe('PENDING'); // inchangée
    });

    it('LINE_STATUS_CHANGED READY met la ligne en READY', () => {
      comp.order.set(makeOrder({ lines: [makeLine({ id: 'l1', status: 'COOKING' })] }));
      (comp as any)['applyEvent']({ eventType: 'LINE_STATUS_CHANGED', lineId: 'l1', lineStatus: 'READY' });

      expect(comp.order()?.lines[0].status).toBe('READY');
    });

    it('LINE_STATUS_CHANGED ne crashe pas si order est null', () => {
      comp.order.set(null);
      expect(() => {
        (comp as any)['applyEvent']({ eventType: 'LINE_STATUS_CHANGED', lineId: 'l1', lineStatus: 'COOKING' });
      }).not.toThrow();
    });
  });

  // ── wsState ────────────────────────────────────────────────────────────────

  describe('wsState', () => {
    it('démarre à "reconnecting" avant la connexion WebSocket', () => {
      // Le signal est initialisé à 'reconnecting' car la connexion n'est pas encore établie
      // (connectionState$ est EMPTY dans les tests)
      expect(comp.wsState()).toBe('reconnecting');
    });
  });
});

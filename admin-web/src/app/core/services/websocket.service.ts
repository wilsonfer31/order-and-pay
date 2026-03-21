import { Injectable, OnDestroy } from '@angular/core';
import { RxStomp, RxStompConfig, RxStompState } from '@stomp/rx-stomp';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface OrderEvent {
  eventType: string;
  restaurantId: string;
  orderId: string;
  tableId?: string;
  tableLabel?: string;
  tableStatus?: string;
  orderStatus?: string;
  lineStatus?: string;
  lineId?: string;
  productName?: string;
  occurredAt: string;
  lines?: { name: string; quantity: number }[];
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private stomp = new RxStomp();
  private destroy$ = new Subject<void>();

  constructor(private auth: AuthService) {}

  connect(): void {
    const config: RxStompConfig = {
      brokerURL: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`,
      connectHeaders: {
        Authorization: `Bearer ${this.auth.getToken()}`
      },
      heartbeatIncoming: 0,
      heartbeatOutgoing: 20000,
      reconnectDelay: 3000,
    };
    this.stomp.configure(config);
    this.stomp.activate();
  }

  disconnect(): void {
    this.stomp.deactivate();
  }

  /** Écoute les événements cuisine pour ce restaurant. */
  kitchenEvents$(restaurantId: string): Observable<OrderEvent> {
    return this.stomp
      .watch(`/topic/kitchen/${restaurantId}`)
      .pipe(
        map(msg => JSON.parse(msg.body) as OrderEvent),
        takeUntil(this.destroy$)
      );
  }

  /** Écoute les mises à jour pour le dashboard en temps réel. */
  dashboardEvents$(restaurantId: string): Observable<OrderEvent> {
    return this.stomp
      .watch(`/topic/dashboard/${restaurantId}`)
      .pipe(
        map(msg => JSON.parse(msg.body) as OrderEvent),
        takeUntil(this.destroy$)
      );
  }

  /** Écoute les changements de statut de table pour la vue salle. */
  floorEvents$(restaurantId: string): Observable<OrderEvent> {
    return this.stomp
      .watch(`/topic/floor/${restaurantId}`)
      .pipe(
        map(msg => JSON.parse(msg.body) as OrderEvent),
        takeUntil(this.destroy$)
      );
  }

  /** Écoute les TABLE_STATUS_CHANGED en temps réel. */
  tablesEvents$(restaurantId: string): Observable<OrderEvent> {
    return this.stomp
      .watch(`/topic/tables/${restaurantId}`)
      .pipe(
        map(msg => JSON.parse(msg.body) as OrderEvent),
        takeUntil(this.destroy$)
      );
  }

  get connected$(): Observable<boolean> {
    return this.stomp.connected$.pipe(
      map(state => state === RxStompState.OPEN)
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stomp.deactivate();
  }
}

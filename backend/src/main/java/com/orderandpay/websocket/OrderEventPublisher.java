package com.orderandpay.websocket;

import com.orderandpay.dto.OrderEventDto;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Publie les événements métier sur les topics STOMP.
 *
 * Topics :
 *  /topic/kitchen/{restaurantId}   → écran cuisine
 *  /topic/floor/{restaurantId}     → tablettes de salle
 *  /topic/client/{orderId}         → app mobile du client
 *  /topic/dashboard/{restaurantId} → dashboard admin (CA temps réel)
 */
@Service
@RequiredArgsConstructor
public class OrderEventPublisher {

    private final SimpMessagingTemplate broker;

    public void notifyKitchen(UUID restaurantId, OrderEventDto event) {
        broker.convertAndSend("/topic/kitchen/" + restaurantId, event);
    }

    public void notifyFloor(UUID restaurantId, OrderEventDto event) {
        broker.convertAndSend("/topic/floor/" + restaurantId, event);
    }

    public void notifyClient(UUID orderId, OrderEventDto event) {
        broker.convertAndSend("/topic/client/" + orderId, event);
    }

    public void notifyDashboard(UUID restaurantId, OrderEventDto event) {
        broker.convertAndSend("/topic/dashboard/" + restaurantId, event);
    }

    public void notifyTables(UUID restaurantId, OrderEventDto event) {
        broker.convertAndSend("/topic/tables/" + restaurantId, event);
    }
}

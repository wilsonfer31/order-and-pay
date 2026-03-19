package com.orderandpay.service;

import com.orderandpay.dto.CreateOrderDto;
import com.orderandpay.dto.OrderEventDto;
import com.orderandpay.entity.*;
import com.orderandpay.repository.*;
import com.orderandpay.websocket.OrderEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository    orderRepository;
    private final TableRepository    tableRepository;
    private final ProductRepository  productRepository;
    private final OrderEventPublisher eventPublisher;

    @Transactional
    public Order createOrder(UUID restaurantId, CreateOrderDto dto) {
        RestaurantTable table = tableRepository
                .findByIdAndRestaurantId(dto.tableId(), restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Table introuvable"));

        Order order = Order.builder()
                .restaurant(table.getRestaurant())
                .table(table)
                .source(Order.OrderSource.valueOf(dto.source()))
                .guestCount(dto.guestCount())
                .notes(dto.notes())
                .status(Order.OrderStatus.CONFIRMED)
                .confirmedAt(Instant.now())
                .build();

        for (CreateOrderDto.LineDto lineDto : dto.lines()) {
            Product product = productRepository
                    .findByIdAndRestaurantId(UUID.fromString(lineDto.productId()), restaurantId)
                    .orElseThrow(() -> new IllegalArgumentException("Produit introuvable: " + lineDto.productId()));

            if (!product.isAvailable()) {
                throw new IllegalStateException("Produit non disponible: " + product.getName());
            }

            // Décrémente le stock si géré
            if (product.isStockManaged()) {
                if (product.getStockQty() == null || product.getStockQty() < lineDto.quantity()) {
                    throw new IllegalStateException("Stock insuffisant: " + product.getName());
                }
                product.setStockQty(product.getStockQty() - lineDto.quantity());
                productRepository.save(product);
            }

            order.getLines().add(
                    OrderLine.from(order, product, lineDto.quantity(), lineDto.notes())
            );
        }

        order.recalculateTotals();
        Order saved = orderRepository.save(order);

        // Mise à jour statut table
        table.setStatus(RestaurantTable.TableStatus.OCCUPIED);
        tableRepository.save(table);

        // Notification WebSocket
        eventPublisher.notifyKitchen(restaurantId,
                OrderEventDto.orderCreated(restaurantId, saved.getId(),
                        table.getId(), table.getLabel()));
        eventPublisher.notifyFloor(restaurantId,
                OrderEventDto.orderCreated(restaurantId, saved.getId(),
                        table.getId(), table.getLabel()));
        eventPublisher.notifyDashboard(restaurantId,
                OrderEventDto.orderCreated(restaurantId, saved.getId(),
                        table.getId(), table.getLabel()));

        log.info("Commande {} créée pour table {} ({})", saved.getId(), table.getLabel(), restaurantId);
        return saved;
    }

    @Transactional
    public OrderLine updateLineStatus(UUID restaurantId, UUID orderId, UUID lineId,
                                      OrderLine.LineStatus newStatus) {
        Order order = orderRepository.findWithLines(orderId, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Commande introuvable"));

        OrderLine line = order.getLines().stream()
                .filter(l -> l.getId().equals(lineId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Ligne introuvable"));

        line.setStatus(newStatus);
        orderRepository.save(order);

        // Notifie la cuisine ET le client mobile
        var event = OrderEventDto.lineStatusChanged(restaurantId, orderId, lineId,
                line.getProduct().getName(), newStatus);
        eventPublisher.notifyKitchen(restaurantId, event);
        eventPublisher.notifyClient(orderId, event);

        // Si toutes les lignes sont READY, notifie la salle
        boolean allReady = order.getLines().stream()
                .filter(l -> l.getStatus() != OrderLine.LineStatus.CANCELLED)
                .allMatch(l -> l.getStatus() == OrderLine.LineStatus.READY
                            || l.getStatus() == OrderLine.LineStatus.SERVED);
        if (allReady) {
            order.setStatus(Order.OrderStatus.READY);
            orderRepository.save(order);
            eventPublisher.notifyFloor(restaurantId,
                    OrderEventDto.lineStatusChanged(restaurantId, orderId, lineId,
                            "Toute la commande", OrderLine.LineStatus.READY));
        }

        return line;
    }

    @Transactional
    public Order markPaid(UUID restaurantId, UUID orderId) {
        Order order = orderRepository.findByIdAndRestaurantId(orderId, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Commande introuvable"));

        order.setStatus(Order.OrderStatus.PAID);
        order.setPaidAt(Instant.now());
        Order saved = orderRepository.save(order);

        // Libère la table
        if (order.getTable() != null) {
            order.getTable().setStatus(RestaurantTable.TableStatus.DIRTY);
            tableRepository.save(order.getTable());
        }

        eventPublisher.notifyDashboard(restaurantId,
                OrderEventDto.orderPaid(restaurantId, orderId));
        eventPublisher.notifyClient(orderId,
                OrderEventDto.orderPaid(restaurantId, orderId));

        return saved;
    }
}

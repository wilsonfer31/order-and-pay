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
import java.util.List;
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

        Order.OrderSource orderSource;
        try {
            orderSource = dto.source() != null
                    ? Order.OrderSource.valueOf(dto.source())
                    : Order.OrderSource.CLIENT_APP;
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Source invalide: " + dto.source());
        }

        Order order = Order.builder()
                .restaurant(table.getRestaurant())
                .table(table)
                .source(orderSource)
                .guestCount(dto.guestCount())
                .notes(dto.notes())
                .status(Order.OrderStatus.CONFIRMED)
                .confirmedAt(Instant.now())
                .build();

        for (CreateOrderDto.LineDto lineDto : dto.lines()) {
            UUID productUUID;
            try {
                productUUID = UUID.fromString(lineDto.productId());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("productId invalide: " + lineDto.productId());
            }

            // Utilise un verrou pessimiste pour les produits avec stock géré
            Product product = productRepository
                    .findByIdAndRestaurantIdForUpdate(productUUID, restaurantId)
                    .orElseThrow(() -> new IllegalArgumentException("Produit introuvable: " + lineDto.productId()));

            if (!product.isAvailable()) {
                throw new IllegalStateException("Produit non disponible: " + product.getName());
            }

            // Décrémente le stock si géré (atomique grâce au verrou pessimiste)
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
        if (table.getStatus() != RestaurantTable.TableStatus.OCCUPIED) {
            table.setSessionStartedAt(Instant.now());
        }
        table.setStatus(RestaurantTable.TableStatus.OCCUPIED);
        tableRepository.save(table);

        eventPublisher.notifyTables(restaurantId,
                OrderEventDto.tableStatusChanged(restaurantId, table.getId(), table.getLabel(), "OCCUPIED"));

        // Lignes de commande pour l'événement WebSocket
        var lineItems = saved.getLines().stream()
                .filter(l -> l.getStatus() != OrderLine.LineStatus.CANCELLED)
                .map(l -> {
                    String name = l.getProductSnapshot() != null
                            ? (String) l.getProductSnapshot().get("name")
                            : l.getProduct().getName();
                    return new OrderEventDto.LineItem(name, l.getQuantity());
                })
                .toList();

        // Notification WebSocket
        var createdEvent = OrderEventDto.orderCreated(restaurantId, saved.getId(),
                table.getId(), table.getLabel(), lineItems);
        eventPublisher.notifyKitchen(restaurantId, createdEvent);
        eventPublisher.notifyFloor(restaurantId, createdEvent);
        eventPublisher.notifyDashboard(restaurantId, createdEvent);

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

        // Si une ligne passe en COOKING et que la commande est encore CONFIRMED, la passer en IN_PROGRESS
        if (newStatus == OrderLine.LineStatus.COOKING
                && order.getStatus() == Order.OrderStatus.CONFIRMED) {
            order.setStatus(Order.OrderStatus.IN_PROGRESS);
            var statusEvent = OrderEventDto.orderStatusChanged(restaurantId, orderId,
                    order.getTable() != null ? order.getTable().getId() : null,
                    order.getTable() != null ? order.getTable().getLabel() : null,
                    Order.OrderStatus.IN_PROGRESS);
            eventPublisher.notifyKitchen(restaurantId, statusEvent);
            eventPublisher.notifyFloor(restaurantId, statusEvent);
            eventPublisher.notifyClient(orderId, statusEvent);
        }

        orderRepository.save(order);

        // Notifie la cuisine ET le client mobile
        var event = OrderEventDto.lineStatusChanged(restaurantId, orderId, lineId,
                line.getProduct().getName(), newStatus);
        eventPublisher.notifyKitchen(restaurantId, event);
        eventPublisher.notifyClient(orderId, event);

        var nonCancelledLines = order.getLines().stream()
                .filter(l -> l.getStatus() != OrderLine.LineStatus.CANCELLED)
                .toList();

        boolean allServed = nonCancelledLines.stream()
                .allMatch(l -> l.getStatus() == OrderLine.LineStatus.SERVED);

        boolean allReadyOrServed = nonCancelledLines.stream()
                .allMatch(l -> l.getStatus() == OrderLine.LineStatus.READY
                            || l.getStatus() == OrderLine.LineStatus.SERVED);

        if (allServed) {
            // Toutes les lignes servies → commande automatiquement livrée
            order.setStatus(Order.OrderStatus.DELIVERED);
            order.setPaidAt(Instant.now());
            orderRepository.save(order);

            var deliveredEvent = OrderEventDto.orderStatusChanged(restaurantId, orderId,
                    order.getTable() != null ? order.getTable().getId() : null,
                    order.getTable() != null ? order.getTable().getLabel() : null,
                    Order.OrderStatus.DELIVERED);
            eventPublisher.notifyKitchen(restaurantId, deliveredEvent);
            eventPublisher.notifyFloor(restaurantId, deliveredEvent);
            eventPublisher.notifyClient(orderId, deliveredEvent);
            eventPublisher.notifyDashboard(restaurantId,
                    OrderEventDto.orderPaid(restaurantId, orderId));

            // Table DIRTY seulement si TOUTES les commandes de la table sont terminées
            if (order.getTable() != null) {
                markTableDirtyIfAllOrdersComplete(restaurantId, order.getTable());
            }

        } else if (allReadyOrServed) {
            order.setStatus(Order.OrderStatus.READY);
            orderRepository.save(order);
            eventPublisher.notifyFloor(restaurantId,
                    OrderEventDto.lineStatusChanged(restaurantId, orderId, lineId,
                            "Toute la commande", OrderLine.LineStatus.READY));
        }

        return line;
    }

    @Transactional
    public Order updateOrderStatus(UUID restaurantId, UUID orderId, Order.OrderStatus newStatus) {
        Order order = orderRepository.findByIdAndRestaurantId(orderId, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Commande introuvable"));

        order.setStatus(newStatus);

        if (newStatus == Order.OrderStatus.DELIVERED) {
            order.setPaidAt(Instant.now());
        }

        Order saved = orderRepository.save(order);

        // Table DIRTY seulement si TOUTES les commandes de la table sont terminées
        if (newStatus == Order.OrderStatus.DELIVERED && order.getTable() != null) {
            markTableDirtyIfAllOrdersComplete(restaurantId, order.getTable());
        }

        var statusEvent = OrderEventDto.orderStatusChanged(restaurantId, orderId,
                order.getTable() != null ? order.getTable().getId() : null,
                order.getTable() != null ? order.getTable().getLabel() : null,
                newStatus);
        eventPublisher.notifyKitchen(restaurantId, statusEvent);
        eventPublisher.notifyFloor(restaurantId, statusEvent);
        eventPublisher.notifyClient(orderId, statusEvent);

        // Notifie le dashboard pour rafraîchir le CA
        if (newStatus == Order.OrderStatus.DELIVERED) {
            eventPublisher.notifyDashboard(restaurantId,
                    OrderEventDto.orderPaid(restaurantId, orderId));
        }

        return saved;
    }

    @Transactional
    public void finalizeTableOrders(UUID tableId) {
        List<Order> activeOrders = orderRepository.findActiveOrdersByTableId(tableId)
                .stream()
                .filter(o -> o.getStatus() != Order.OrderStatus.DELIVERED
                          && o.getStatus() != Order.OrderStatus.PAID)
                .toList();

        for (Order order : activeOrders) {
            order.setStatus(Order.OrderStatus.DELIVERED);
            order.setPaidAt(Instant.now());
            orderRepository.save(order);

            UUID restaurantId = order.getRestaurant().getId();
            eventPublisher.notifyDashboard(restaurantId,
                    OrderEventDto.orderPaid(restaurantId, order.getId()));
        }
    }

    /** Passe la table en DIRTY uniquement si toutes ses commandes actives sont DELIVERED ou PAID. */
    private void markTableDirtyIfAllOrdersComplete(UUID restaurantId, RestaurantTable table) {
        boolean allDone = orderRepository.findActiveOrdersByTableId(table.getId())
                .stream()
                .allMatch(o -> o.getStatus() == Order.OrderStatus.DELIVERED
                            || o.getStatus() == Order.OrderStatus.PAID
                            || o.getStatus() == Order.OrderStatus.CANCELLED);
        if (allDone) {
            table.setStatus(RestaurantTable.TableStatus.DIRTY);
            tableRepository.save(table);
            eventPublisher.notifyTables(restaurantId,
                    OrderEventDto.tableStatusChanged(restaurantId, table.getId(), table.getLabel(), "DIRTY"));
        }
    }

    @Transactional
    public Order markPaid(UUID restaurantId, UUID orderId) {
        Order order = orderRepository.findByIdAndRestaurantId(orderId, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Commande introuvable"));

        order.setStatus(Order.OrderStatus.PAID);
        order.setPaidAt(Instant.now());
        Order saved = orderRepository.save(order);

        // Table DIRTY seulement si TOUTES les commandes de la table sont terminées
        if (order.getTable() != null) {
            markTableDirtyIfAllOrdersComplete(restaurantId, order.getTable());
        }

        eventPublisher.notifyDashboard(restaurantId,
                OrderEventDto.orderPaid(restaurantId, orderId));
        eventPublisher.notifyClient(orderId,
                OrderEventDto.orderPaid(restaurantId, orderId));

        return saved;
    }
}

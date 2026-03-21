package com.orderandpay.dto;

import com.orderandpay.entity.Order;
import com.orderandpay.entity.OrderLine;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderEventDto(
        String    eventType,      // ORDER_CREATED | LINE_STATUS_CHANGED | ORDER_PAID | TABLE_STATUS_CHANGED
        UUID      restaurantId,
        UUID      orderId,
        UUID      tableId,
        String    tableLabel,
        String    tableStatus,
        Order.OrderStatus   orderStatus,
        OrderLine.LineStatus lineStatus,
        UUID      lineId,
        String    productName,
        Instant   occurredAt,
        List<LineItem> lines
) {
    public record LineItem(String name, int quantity) {}

    public static OrderEventDto orderCreated(UUID restaurantId, UUID orderId, UUID tableId,
                                             String tableLabel, List<LineItem> lines) {
        return new OrderEventDto("ORDER_CREATED", restaurantId, orderId, tableId, tableLabel,
                null, Order.OrderStatus.CONFIRMED, null, null, null, Instant.now(), lines);
    }

    public static OrderEventDto lineStatusChanged(UUID restaurantId, UUID orderId, UUID lineId,
                                                   String productName, OrderLine.LineStatus status) {
        return new OrderEventDto("LINE_STATUS_CHANGED", restaurantId, orderId, null, null,
                null, null, status, lineId, productName, Instant.now(), null);
    }

    public static OrderEventDto orderStatusChanged(UUID restaurantId, UUID orderId, UUID tableId,
                                                    String tableLabel, Order.OrderStatus status) {
        return new OrderEventDto("ORDER_STATUS_CHANGED", restaurantId, orderId, tableId, tableLabel,
                null, status, null, null, null, Instant.now(), null);
    }

    public static OrderEventDto orderPaid(UUID restaurantId, UUID orderId) {
        return new OrderEventDto("ORDER_PAID", restaurantId, orderId, null, null,
                null, Order.OrderStatus.PAID, null, null, null, Instant.now(), null);
    }

    public static OrderEventDto tableStatusChanged(UUID restaurantId, UUID tableId, String tableLabel, String status) {
        return new OrderEventDto("TABLE_STATUS_CHANGED", restaurantId, null, tableId, tableLabel,
                status, null, null, null, null, Instant.now(), null);
    }

    public static OrderEventDto tablesUpdated(UUID restaurantId) {
        return new OrderEventDto("TABLES_UPDATED", restaurantId, null, null, null,
                null, null, null, null, null, Instant.now(), null);
    }
}

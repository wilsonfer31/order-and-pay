package com.orderandpay.dto;

import com.orderandpay.entity.Order;
import com.orderandpay.entity.OrderLine;

import java.time.Instant;
import java.util.UUID;

public record OrderEventDto(
        String    eventType,      // ORDER_CREATED | LINE_STATUS_CHANGED | ORDER_PAID | TABLE_STATUS_CHANGED
        UUID      restaurantId,
        UUID      orderId,
        UUID      tableId,
        String    tableLabel,
        Order.OrderStatus   orderStatus,
        OrderLine.LineStatus lineStatus,
        UUID      lineId,
        String    productName,
        Instant   occurredAt
) {
    public static OrderEventDto orderCreated(UUID restaurantId, UUID orderId, UUID tableId, String tableLabel) {
        return new OrderEventDto("ORDER_CREATED", restaurantId, orderId, tableId, tableLabel,
                Order.OrderStatus.CONFIRMED, null, null, null, Instant.now());
    }

    public static OrderEventDto lineStatusChanged(UUID restaurantId, UUID orderId, UUID lineId,
                                                   String productName, OrderLine.LineStatus status) {
        return new OrderEventDto("LINE_STATUS_CHANGED", restaurantId, orderId, null, null,
                null, status, lineId, productName, Instant.now());
    }

    public static OrderEventDto orderPaid(UUID restaurantId, UUID orderId) {
        return new OrderEventDto("ORDER_PAID", restaurantId, orderId, null, null,
                Order.OrderStatus.PAID, null, null, null, Instant.now());
    }
}

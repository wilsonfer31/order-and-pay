package com.orderandpay.controller;

import com.orderandpay.dto.CreateOrderDto;
import com.orderandpay.entity.Order;
import com.orderandpay.entity.OrderLine;
import com.orderandpay.repository.OrderRepository;
import com.orderandpay.security.TenantContext;
import com.orderandpay.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService    orderService;
    private final OrderRepository orderRepository;

    @PostMapping
    public ResponseEntity<Order> create(@Valid @RequestBody CreateOrderDto dto) {
        Order order = orderService.createOrder(TenantContext.getCurrentTenant(), dto);
        return ResponseEntity
                .created(URI.create("/orders/" + order.getId()))
                .body(order);
    }

    @GetMapping
    public List<Order> listActive() {
        return orderRepository.findByRestaurantIdAndStatus(
                TenantContext.getCurrentTenant(), Order.OrderStatus.CONFIRMED);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> get(@PathVariable UUID id) {
        return orderRepository.findWithLines(id, TenantContext.getCurrentTenant())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/lines/{lineId}/status")
    @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','OWNER')")
    public ResponseEntity<OrderLine> updateLineStatus(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @RequestParam  String status) {

        OrderLine.LineStatus newStatus = OrderLine.LineStatus.valueOf(status.toUpperCase());
        return ResponseEntity.ok(
                orderService.updateLineStatus(TenantContext.getCurrentTenant(), id, lineId, newStatus)
        );
    }

    @PostMapping("/{id}/pay")
    @PreAuthorize("hasAnyRole('CASHIER','MANAGER','OWNER')")
    public ResponseEntity<Order> pay(@PathVariable UUID id) {
        return ResponseEntity.ok(
                orderService.markPaid(TenantContext.getCurrentTenant(), id)
        );
    }
}

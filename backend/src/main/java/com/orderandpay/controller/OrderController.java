package com.orderandpay.controller;

import com.orderandpay.dto.CreateOrderDto;
import com.orderandpay.entity.Order;
import com.orderandpay.entity.OrderLine;
import com.orderandpay.repository.OrderRepository;
import com.orderandpay.security.TenantContext;
import com.orderandpay.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
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
    public List<Map<String, Object>> listActive() {
        var statuses = List.of(
            Order.OrderStatus.CONFIRMED,
            Order.OrderStatus.IN_PROGRESS,
            Order.OrderStatus.READY
        );
        return orderRepository.findActiveByRestaurantId(TenantContext.getCurrentTenant(), statuses)
                .stream()
                .map(o -> {
                    var lines = o.getLines().stream()
                            .filter(l -> l.getStatus() != OrderLine.LineStatus.CANCELLED)
                            .map(l -> {
                                java.util.LinkedHashMap<String, Object> lm = new java.util.LinkedHashMap<>();
                                lm.put("id", l.getId().toString());
                                lm.put("productName", l.getProduct().getName());
                                lm.put("quantity", l.getQuantity());
                                lm.put("status", l.getStatus().name());
                                lm.put("notes", l.getNotes());
                                lm.put("options", l.getSelectedOptions().stream()
                                        .map(opt -> opt.getOptionName() != null
                                                ? opt.getOptionName() + " : " + opt.getLabel()
                                                : opt.getLabel())
                                        .toList());
                                return lm;
                            })
                            .toList();
                    java.util.LinkedHashMap<String, Object> om = new java.util.LinkedHashMap<>();
                    om.put("orderId", o.getId().toString());
                    om.put("orderNumber", o.getOrderNumber());
                    om.put("tableLabel", o.getTable() != null ? o.getTable().getLabel() : "");
                    om.put("status", o.getStatus().name());
                    om.put("totalTtc", o.getTotalTtc());
                    om.put("confirmedAt", o.getConfirmedAt() != null ? o.getConfirmedAt().toString() : null);
                    om.put("lines", lines);
                    return (Map<String, Object>) om;
                })
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> get(@PathVariable UUID id) {
        return orderRepository.findWithLines(id, TenantContext.getCurrentTenant())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','OWNER')")
    public ResponseEntity<Map<String, Object>> updateStatus(
            @PathVariable UUID id,
            @RequestParam String status) {
        Order.OrderStatus newStatus = Order.OrderStatus.valueOf(status.toUpperCase());
        Order order = orderService.updateOrderStatus(TenantContext.getCurrentTenant(), id, newStatus);
        java.util.LinkedHashMap<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("orderId", order.getId().toString());
        resp.put("status", order.getStatus().name());
        return ResponseEntity.ok(resp);
    }

    @PatchMapping("/{id}/lines/{lineId}/status")
    @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','OWNER')")
    public ResponseEntity<Map<String, Object>> updateLineStatus(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @RequestParam  String status) {

        OrderLine.LineStatus newStatus = OrderLine.LineStatus.valueOf(status.toUpperCase());
        OrderLine line = orderService.updateLineStatus(TenantContext.getCurrentTenant(), id, lineId, newStatus);
        java.util.LinkedHashMap<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("lineId", line.getId().toString());
        resp.put("status", line.getStatus().name());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/history")
    public Map<String, Object> history(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int pageSize) {

        // Clamp pageSize to prevent abuse
        pageSize = Math.min(pageSize, 200);

        Instant fromInstant = (from != null && !from.isBlank())
                ? LocalDate.parse(from).atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.EPOCH;
        Instant toInstant = (to != null && !to.isBlank())
                ? LocalDate.parse(to).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.now().plus(36500, java.time.temporal.ChronoUnit.DAYS);

        UUID restaurantId = TenantContext.getCurrentTenant();

        long total = orderRepository.countHistory(restaurantId, fromInstant, toInstant);

        List<UUID> ids = orderRepository.findHistoryIds(
                restaurantId, fromInstant, toInstant,
                PageRequest.of(page, pageSize));

        List<Map<String, Object>> orders = ids.isEmpty()
                ? List.of()
                : orderRepository.findHistoryByIds(ids).stream()
                        .map(o -> {
                            var lines = o.getLines().stream()
                                    .filter(l -> l.getStatus() != OrderLine.LineStatus.CANCELLED)
                                    .map(l -> {
                                        java.util.LinkedHashMap<String, Object> lm = new java.util.LinkedHashMap<>();
                                        lm.put("productName", l.getProduct().getName());
                                        lm.put("quantity",    l.getQuantity());
                                        lm.put("unitPriceHt",  l.getUnitPriceHt());
                                        return lm;
                                    })
                                    .toList();
                            java.util.LinkedHashMap<String, Object> om = new java.util.LinkedHashMap<>();
                            om.put("orderId",      o.getId().toString());
                            om.put("orderNumber",  o.getOrderNumber());
                            om.put("tableLabel",   o.getTable() != null ? o.getTable().getLabel() : "—");
                            om.put("status",       o.getStatus().name());
                            om.put("source",       o.getSource() != null ? o.getSource().name() : "CLIENT_APP");
                            om.put("totalHt",      o.getTotalHt());
                            om.put("totalTtc",     o.getTotalTtc());
                            om.put("confirmedAt",  o.getConfirmedAt() != null ? o.getConfirmedAt().toString() : null);
                            om.put("paidAt",       o.getPaidAt() != null ? o.getPaidAt().toString() : null);
                            om.put("lines",        lines);
                            return (Map<String, Object>) om;
                        })
                        .toList();

        java.util.LinkedHashMap<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("orders",   orders);
        result.put("total",    total);
        result.put("page",     page);
        result.put("pageSize", pageSize);
        return result;
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','OWNER')")
    public ResponseEntity<Void> cancel(@PathVariable UUID id) {
        orderService.cancelOrder(TenantContext.getCurrentTenant(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/pay")
    @PreAuthorize("hasAnyRole('CASHIER','MANAGER','OWNER')")
    public ResponseEntity<Order> pay(@PathVariable UUID id) {
        return ResponseEntity.ok(
                orderService.markPaid(TenantContext.getCurrentTenant(), id)
        );
    }
}

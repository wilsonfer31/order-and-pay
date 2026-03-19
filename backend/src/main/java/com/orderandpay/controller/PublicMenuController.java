package com.orderandpay.controller;

import com.orderandpay.dto.CreateOrderDto;
import com.orderandpay.dto.MenuResponseDto;
import com.orderandpay.entity.Order;
import com.orderandpay.entity.RestaurantTable;
import com.orderandpay.repository.TableRepository;
import com.orderandpay.service.MenuService;
import com.orderandpay.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/public")
@RequiredArgsConstructor
public class PublicMenuController {

    private final TableRepository tableRepository;
    private final MenuService     menuService;
    private final OrderService    orderService;

    /**
     * Endpoint sans authentification : le client scanne le QR code,
     * récupère le menu complet lié à sa table.
     */
    @GetMapping("/menu")
    public ResponseEntity<MenuResponseDto> getMenu(@RequestParam String t) {
        RestaurantTable table = tableRepository.findByQrToken(t)
                .or(() -> tableRepository.findByLabelIgnoreCase(t))
                .orElseThrow(() -> new RuntimeException("Table introuvable"));

        return ResponseEntity.ok(menuService.buildMenuResponse(table));
    }

    @GetMapping("/tables/by-token")
    public ResponseEntity<?> findByToken(@RequestParam String t) {
        // Cherche d'abord par QR token, puis par libellé (ex: "T1")
        Optional<RestaurantTable> result = tableRepository.findByQrToken(t);
        if (result.isEmpty()) {
            result = tableRepository.findByLabelIgnoreCase(t);
        }
        return result
                .map(table -> ResponseEntity.ok(Map.of(
                    "id",      table.getId().toString(),
                    "label",   table.getLabel(),
                    "qrToken", table.getQrToken(),
                    "status",  table.getStatus().name()
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Soumission de commande par le client mobile (sans authentification).
     * Le restaurant est résolu depuis la table.
     */
    @PostMapping("/orders")
    @Transactional
    public ResponseEntity<?> placeOrder(@Valid @RequestBody CreateOrderDto dto) {
        RestaurantTable table = tableRepository.findById(dto.tableId())
                .orElseThrow(() -> new RuntimeException("Table introuvable"));

        Order order = orderService.createOrder(table.getRestaurant().getId(), dto);

        return ResponseEntity.status(201).body(Map.of(
            "orderId",     order.getId().toString(),
            "orderNumber", order.getOrderNumber(),
            "totalTtc",    order.getTotalTtc(),
            "status",      order.getStatus().name()
        ));
    }
}

package com.orderandpay.controller;

import com.orderandpay.dto.CreateOrderDto;
import com.orderandpay.dto.MenuResponseDto;
import com.orderandpay.entity.Order;
import com.orderandpay.entity.OrderLine;
import com.orderandpay.entity.RestaurantTable;
import com.orderandpay.repository.OrderRepository;
import com.orderandpay.repository.ProductRepository;
import com.orderandpay.repository.TableRepository;
import com.orderandpay.service.MenuService;
import com.orderandpay.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/public")
@RequiredArgsConstructor
public class PublicMenuController {

    @Value("${app.uploads.path:./uploads}")
    private String uploadsPath;

    private final TableRepository   tableRepository;
    private final OrderRepository   orderRepository;
    private final ProductRepository productRepository;
    private final MenuService       menuService;
    private final OrderService      orderService;

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

    /** Liste toutes les tables (pour la vue de sélection mobile). */
    @GetMapping("/tables")
    public ResponseEntity<?> listTables() {
        List<Map<String, Object>> tables = tableRepository.findAllByOrderByLabel().stream()
                .map(t -> Map.<String, Object>of(
                        "id",       t.getId().toString(),
                        "label",    t.getLabel(),
                        "qrToken",  t.getQrToken() != null ? t.getQrToken() : "",
                        "status",   t.getStatus().name(),
                        "capacity", t.getCapacity()
                ))
                .toList();
        return ResponseEntity.ok(tables);
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
     * La table est validée via le QR token pour éviter toute commande frauduleuse.
     */
    @PostMapping("/orders")
    @Transactional
    public ResponseEntity<?> placeOrder(@Valid @RequestBody CreateOrderDto dto) {
        RestaurantTable table;
        if (dto.tableToken() != null && !dto.tableToken().isBlank()) {
            table = tableRepository.findByIdAndQrToken(dto.tableId(), dto.tableToken())
                    .or(() -> tableRepository.findById(dto.tableId())
                            .filter(t -> dto.tableToken().equalsIgnoreCase(t.getLabel())))
                    .orElseThrow(() -> new IllegalArgumentException("Table introuvable ou token invalide"));
        } else {
            table = tableRepository.findById(dto.tableId())
                    .orElseThrow(() -> new IllegalArgumentException("Table introuvable"));
        }

        Order order = orderService.createOrder(table.getRestaurant().getId(), dto);

        java.util.Map<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("orderId",     order.getId().toString());
        resp.put("orderNumber", order.getOrderNumber());
        resp.put("totalTtc",    order.getTotalTtc());
        resp.put("status",      order.getStatus().name());
        return ResponseEntity.status(201).body(resp);
    }

    /** Marque une table comme propre (DIRTY → FREE) depuis l'app mobile. */
    @PatchMapping("/tables/{tableId}/clean")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> markTableClean(@PathVariable UUID tableId) {
        orderService.finalizeTableOrders(tableId);
        tableRepository.findById(tableId).ifPresent(table -> {
            table.setStatus(RestaurantTable.TableStatus.FREE);
            tableRepository.save(table);
        });
        return ResponseEntity.noContent().build();
    }

    /** Toutes les commandes actives d'une table (pour la vue suivi côté client). */
    @GetMapping("/tables/orders")
    public ResponseEntity<?> getTableOrders(@RequestParam String t) {
        Optional<RestaurantTable> tableOpt = tableRepository.findByQrToken(t);
        if (tableOpt.isEmpty()) tableOpt = tableRepository.findByLabelIgnoreCase(t);
        if (tableOpt.isEmpty()) return ResponseEntity.notFound().build();

        RestaurantTable table = tableOpt.get();
        List<Map<String, Object>> orders = orderRepository.findActiveOrdersByTableId(table.getId())
                .stream()
                .filter(o -> o.getStatus() != Order.OrderStatus.DELIVERED
                          && o.getStatus() != Order.OrderStatus.PAID)
                .map(o -> {
                    List<Map<String, Object>> lines = o.getLines().stream()
                            .filter(l -> l.getStatus() != OrderLine.LineStatus.CANCELLED)
                            .map(l -> {
                                java.util.Map<String, Object> lm = new java.util.LinkedHashMap<>();
                                lm.put("id",          l.getId().toString());
                                lm.put("productName", l.getProduct().getName());
                                lm.put("quantity",    l.getQuantity());
                                lm.put("status",      l.getStatus().name());
                                return lm;
                            })
                            .toList();
                    java.util.Map<String, Object> om = new java.util.LinkedHashMap<>();
                    om.put("orderId",  o.getId().toString());
                    om.put("status",   o.getStatus().name());
                    om.put("totalTtc", o.getTotalTtc());
                    om.put("lines",    lines);
                    return om;
                })
                .toList();
        return ResponseEntity.ok(orders);
    }

    /**
     * Upload d'image de produit depuis l'app mobile (sans authentification).
     * Le token de table sert de validation minimale.
     */
    @PostMapping("/products/{id}/image")
    @CacheEvict(value = "menu", allEntries = true)
    public ResponseEntity<Map<String, String>> uploadProductImage(
            @PathVariable UUID id,
            @RequestParam String t,
            @RequestParam("file") MultipartFile file) throws IOException {

        // Validate table token exists
        tableRepository.findByQrToken(t)
                .or(() -> tableRepository.findByLabelIgnoreCase(t))
                .orElseThrow(() -> new IllegalArgumentException("Token invalide"));

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().build();
        }

        com.orderandpay.entity.Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));

        String originalName = file.getOriginalFilename();
        String ext = (originalName != null && originalName.contains("."))
                ? originalName.substring(originalName.lastIndexOf('.'))
                : ".jpg";
        String filename = java.util.UUID.randomUUID() + ext;

        Path uploadDir = Paths.get(uploadsPath, "images");
        Files.createDirectories(uploadDir);
        Files.copy(file.getInputStream(), uploadDir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

        String imageUrl = "/api/uploads/images/" + filename;
        product.setImageUrl(imageUrl);
        productRepository.save(product);

        java.util.LinkedHashMap<String, String> resp = new java.util.LinkedHashMap<>();
        resp.put("imageUrl", imageUrl);
        return ResponseEntity.ok(resp);
    }

    /**
     * Permet au client de récupérer l'état initial de sa commande pour la page de suivi.
     */
    @GetMapping("/orders/{orderId}")
    public ResponseEntity<?> getOrderState(@PathVariable UUID orderId) {
        Order order = orderRepository.findWithLinesById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Commande introuvable"));

        List<Map<String, Object>> lines = order.getLines().stream()
                .filter(l -> l.getStatus() != OrderLine.LineStatus.CANCELLED)
                .map(l -> Map.<String, Object>of(
                        "id",          l.getId().toString(),
                        "productName", l.getProduct().getName(),
                        "quantity",    l.getQuantity(),
                        "status",      l.getStatus().name()
                ))
                .toList();

        return ResponseEntity.ok(Map.of(
                "orderId",    order.getId().toString(),
                "tableLabel", order.getTable() != null ? order.getTable().getLabel() : "",
                "status",     order.getStatus().name(),
                "totalTtc",   order.getTotalTtc(),
                "lines",      lines
        ));
    }
}

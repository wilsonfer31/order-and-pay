package com.orderandpay.controller;

import com.orderandpay.dto.CreateOrderDto;
import com.orderandpay.dto.MenuResponseDto;
import com.orderandpay.entity.Order;
import com.orderandpay.entity.OrderLine;
import com.orderandpay.entity.RestaurantTable;
import com.orderandpay.repository.OrderRepository;
import com.orderandpay.repository.ProductRepository;
import com.orderandpay.repository.TableRepository;
import com.orderandpay.dto.OrderEventDto;
import com.orderandpay.service.AuditService;
import com.orderandpay.service.MenuService;
import com.orderandpay.service.OrderService;
import com.orderandpay.websocket.OrderEventPublisher;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import net.coobird.thumbnailator.Thumbnails;
import net.coobird.thumbnailator.geometry.Positions;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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
    private final OrderEventPublisher eventPublisher;
    private final AuditService      auditService;

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

    /**
     * Liste les tables pour la vue de sélection mobile.
     * - {@code restaurantId} : filtre direct par restaurant (cas nominal — app configurée)
     * - {@code t} : résout le restaurant via QR token (après un premier scan)
     * - aucun paramètre : retourne toutes les tables (compatibilité, déploiement mono-restaurant)
     */
    @GetMapping("/tables")
    public ResponseEntity<?> listTables(@RequestParam(required = false) UUID restaurantId,
                                        @RequestParam(required = false) String t) {
        List<RestaurantTable> source;

        if (restaurantId != null) {
            source = tableRepository.findByRestaurantIdOrderByLabel(restaurantId);
        } else if (t != null && !t.isBlank()) {
            RestaurantTable ref = tableRepository.findByQrToken(t)
                    .or(() -> tableRepository.findByLabelIgnoreCase(t))
                    .orElse(null);
            if (ref == null) return ResponseEntity.ok(List.of());
            source = tableRepository.findByRestaurantIdOrderByLabel(ref.getRestaurant().getId());
        } else {
            source = tableRepository.findAllByOrderByLabel();
        }

        List<Map<String, Object>> tables = source.stream()
                .map(tb -> {
                    Map<String, Object> map = new java.util.LinkedHashMap<>();
                    map.put("id",           tb.getId().toString());
                    map.put("label",        tb.getLabel());
                    map.put("qrToken",      tb.getQrToken() != null ? tb.getQrToken() : "");
                    map.put("status",       tb.getStatus().name());
                    map.put("capacity",     tb.getCapacity());
                    map.put("restaurantId", tb.getRestaurant().getId().toString());
                    return map;
                })
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
        if (dto.tableToken() == null || dto.tableToken().isBlank()) {
            throw new IllegalArgumentException("Token de table requis");
        }

        RestaurantTable table = tableRepository.findByIdAndQrToken(dto.tableId(), dto.tableToken())
                .or(() -> tableRepository.findById(dto.tableId())
                        .filter(t -> dto.tableToken().equalsIgnoreCase(t.getLabel())))
                .orElseThrow(() -> new IllegalArgumentException("Table introuvable ou token invalide"));

        Order order = orderService.createOrder(table.getRestaurant().getId(), dto);

        java.util.Map<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("orderId",     order.getId().toString());
        resp.put("orderNumber", order.getOrderNumber());
        resp.put("totalTtc",    order.getTotalTtc());
        resp.put("status",      order.getStatus().name());
        return ResponseEntity.status(201).body(resp);
    }

    /**
     * Marque une table comme propre (DIRTY → FREE) depuis l'app mobile.
     * Le paramètre {@code t} (QR token ou libellé) valide que l'appelant est
     * physiquement présent à cette table — empêche tout IDOR sur tableId.
     */
    @PatchMapping("/tables/{tableId}/clean")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> markTableClean(@PathVariable UUID tableId,
                                               @RequestParam String t) {
        // Valide que le token appartient bien à cette table
        RestaurantTable table = tableRepository.findByIdAndQrToken(tableId, t)
                .or(() -> tableRepository.findById(tableId)
                        .filter(tb -> t.equalsIgnoreCase(tb.getLabel())))
                .orElseThrow(() -> new IllegalArgumentException("Table introuvable ou token invalide"));

        orderService.finalizeTableOrders(tableId);

        table.setStatus(RestaurantTable.TableStatus.FREE);
        tableRepository.save(table);
        UUID restaurantId = table.getRestaurant().getId();
        eventPublisher.notifyTables(restaurantId,
                OrderEventDto.tableStatusChanged(restaurantId, table.getId(), table.getLabel(), "FREE"));

        return ResponseEntity.noContent().build();
    }

    /** Toutes les commandes actives d'une table (pour la vue suivi côté client). */
    @GetMapping("/tables/orders")
    public ResponseEntity<?> getTableOrders(@RequestParam String t) {
        Optional<RestaurantTable> tableOpt = tableRepository.findByQrToken(t);
        if (tableOpt.isEmpty()) tableOpt = tableRepository.findByLabelIgnoreCase(t);
        if (tableOpt.isEmpty()) return ResponseEntity.notFound().build();

        RestaurantTable table = tableOpt.get();

        // Après nettoyage (FREE), aucune commande à afficher (nouvelle session)
        if (table.getStatus() == RestaurantTable.TableStatus.FREE
                || table.getStatus() == RestaurantTable.TableStatus.RESERVED) {
            return ResponseEntity.ok(List.of());
        }

        // Quand la table est à nettoyer (DIRTY), on montre toutes les commandes y compris
        // les commandes livrées/payées pour permettre la consultation avant nettoyage.
        // Sinon (OCCUPIED), on masque les commandes déjà livrées/payées.
        boolean isDirty = table.getStatus() == RestaurantTable.TableStatus.DIRTY;

        // Filtre sur la session courante : on n'affiche que les commandes
        // passées depuis le début de la session (sessionStartedAt).
        // Fallback : 24h si la colonne est null (tables créées avant la migration).
        Instant sessionStart = table.getSessionStartedAt() != null
                ? table.getSessionStartedAt()
                : Instant.now().minus(24, ChronoUnit.HOURS);

        List<Map<String, Object>> orders = orderRepository.findActiveOrdersByTableId(table.getId())
                .stream()
                .filter(o -> o.getConfirmedAt() != null && !o.getConfirmedAt().isBefore(sessionStart.minusSeconds(1)))
                .filter(o -> isDirty || (o.getStatus() != Order.OrderStatus.DELIVERED
                          && o.getStatus() != Order.OrderStatus.PAID))
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
                    om.put("orderId",     o.getId().toString());
                    om.put("status",      o.getStatus().name());
                    om.put("totalTtc",    o.getTotalTtc());
                    om.put("confirmedAt", o.getConfirmedAt() != null ? o.getConfirmedAt().toString() : null);
                    om.put("lines",       lines);
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

        // Validate table token and resolve its restaurant
        RestaurantTable tableRef = tableRepository.findByQrToken(t)
                .or(() -> tableRepository.findByLabelIgnoreCase(t))
                .orElseThrow(() -> new IllegalArgumentException("Token invalide"));

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().build();
        }

        com.orderandpay.entity.Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));

        // Validate product belongs to the same restaurant as the table token (prevents cross-tenant IDOR)
        if (!product.getRestaurant().getId().equals(tableRef.getRestaurant().getId())) {
            return ResponseEntity.status(403).build();
        }

        // Toujours sauvegarder en JPEG pour uniformiser et réduire le poids
        String filename = UUID.randomUUID() + ".jpg";

        Path uploadDir = Paths.get(uploadsPath, "images");
        Files.createDirectories(uploadDir);

        // Redimensionne à max 1200px (largeur ou hauteur), qualité 85%
        // Si l'image est déjà petite elle n'est pas agrandie (keepAspectRatio + .asIs())
        try (InputStream in = file.getInputStream()) {
            Thumbnails.of(in)
                    .size(1200, 1200)
                    .keepAspectRatio(true)
                    .outputFormat("jpg")
                    .outputQuality(0.85)
                    .toFile(uploadDir.resolve(filename).toFile());
        }

        String imageUrl = "/api/uploads/images/" + filename;
        product.setImageUrl(imageUrl);
        productRepository.save(product);

        java.util.LinkedHashMap<String, String> resp = new java.util.LinkedHashMap<>();
        resp.put("imageUrl", imageUrl);
        return ResponseEntity.ok(resp);
    }

    /**
     * Annulation d'une commande par le client (uniquement si CONFIRMED — pas encore en cuisine).
     * Le paramètre {@code t} (QR token ou libellé) valide que l'appelant est bien
     * à la table concernée — empêche l'annulation de commandes d'un autre restaurant.
     */
    @DeleteMapping("/orders/{orderId}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> cancelOrder(@PathVariable UUID orderId,
                                         @RequestParam String t) {
        // Valide le token et résout le restaurant
        RestaurantTable tableRef = tableRepository.findByQrToken(t)
                .or(() -> tableRepository.findByLabelIgnoreCase(t))
                .orElseThrow(() -> new IllegalArgumentException("Token invalide"));

        Order order = orderRepository.findWithLinesById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Commande introuvable"));

        // Vérifie que la commande appartient au même restaurant que le token
        if (!order.getRestaurant().getId().equals(tableRef.getRestaurant().getId())) {
            return ResponseEntity.status(403).build();
        }

        if (order.getStatus() == Order.OrderStatus.DELIVERED
                || order.getStatus() == Order.OrderStatus.PAID
                || order.getStatus() == Order.OrderStatus.CANCELLED) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Impossible d'annuler une commande en statut " + order.getStatus()));
        }

        UUID restaurantId = order.getRestaurant().getId();
        auditService.log(restaurantId, "client@" + tableRef.getLabel(),
                "ORDER_CANCELLED", orderId,
                "{\"table\":\"" + tableRef.getLabel() + "\",\"via\":\"mobile\"}");
        orderService.cancelOrder(restaurantId, orderId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Checklist bar : lignes BAR en attente pour un restaurant.
     * Le token de table {@code t} est utilisé pour résoudre le restaurant (pas d'auth requise).
     */
    @GetMapping("/bar")
    public ResponseEntity<?> getBarLines(@RequestParam String t) {
        RestaurantTable ref = tableRepository.findByQrToken(t)
                .or(() -> tableRepository.findByLabelIgnoreCase(t))
                .orElseThrow(() -> new IllegalArgumentException("Token invalide"));
        UUID restaurantId = ref.getRestaurant().getId();

        var statuses = List.of(
                Order.OrderStatus.CONFIRMED,
                Order.OrderStatus.IN_PROGRESS,
                Order.OrderStatus.READY
        );
        var result = orderRepository.findActiveByRestaurantId(restaurantId, statuses).stream()
                .map(o -> {
                    var lines = o.getLines().stream()
                            .filter(l -> "BAR".equals(l.getDestination()))
                            .filter(l -> l.getStatus() != com.orderandpay.entity.OrderLine.LineStatus.CANCELLED
                                      && l.getStatus() != com.orderandpay.entity.OrderLine.LineStatus.SERVED)
                            .map(l -> {
                                java.util.LinkedHashMap<String, Object> lm = new java.util.LinkedHashMap<>();
                                lm.put("id",          l.getId().toString());
                                lm.put("productName", l.getProduct().getName());
                                lm.put("quantity",    l.getQuantity());
                                lm.put("status",      l.getStatus().name());
                                lm.put("notes",       l.getNotes());
                                return lm;
                            })
                            .toList();
                    if (lines.isEmpty()) return null;
                    java.util.LinkedHashMap<String, Object> om = new java.util.LinkedHashMap<>();
                    om.put("orderId",     o.getId().toString());
                    om.put("orderNumber", o.getOrderNumber());
                    om.put("tableLabel",  o.getTable() != null ? o.getTable().getLabel() : "");
                    om.put("confirmedAt", o.getConfirmedAt() != null ? o.getConfirmedAt().toString() : null);
                    om.put("lines",       lines);
                    return om;
                })
                .filter(java.util.Objects::nonNull)
                .toList();
        return ResponseEntity.ok(result);
    }

    /**
     * Marque une ligne BAR comme prête (PENDING → READY) depuis l'app mobile du serveur.
     * Le token {@code t} valide l'appartenance au restaurant.
     */
    @PatchMapping("/bar/orders/{orderId}/lines/{lineId}/ready")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> markBarLineReady(
            @PathVariable UUID orderId,
            @PathVariable UUID lineId,
            @RequestParam String t) {

        RestaurantTable ref = tableRepository.findByQrToken(t)
                .or(() -> tableRepository.findByLabelIgnoreCase(t))
                .orElseThrow(() -> new IllegalArgumentException("Token invalide"));
        UUID restaurantId = ref.getRestaurant().getId();

        orderRepository.findWithLines(orderId, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Commande introuvable"));

        orderService.updateLineStatus(restaurantId, orderId, lineId,
                com.orderandpay.entity.OrderLine.LineStatus.READY);

        return ResponseEntity.ok(Map.of("lineId", lineId.toString(), "status", "READY"));
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

        Map<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("orderId",      order.getId().toString());
        resp.put("tableLabel",   order.getTable() != null ? order.getTable().getLabel() : "");
        resp.put("status",       order.getStatus().name());
        resp.put("totalTtc",     order.getTotalTtc());
        resp.put("confirmedAt",  order.getConfirmedAt() != null ? order.getConfirmedAt().toString() : null);
        resp.put("lines",        lines);
        return ResponseEntity.ok(resp);
    }
}

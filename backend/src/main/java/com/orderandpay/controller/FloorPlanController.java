package com.orderandpay.controller;

import com.orderandpay.dto.OrderEventDto;
import com.orderandpay.dto.TablePositionDto;
import com.orderandpay.entity.FloorPlan;
import com.orderandpay.entity.RestaurantTable;
import com.orderandpay.repository.FloorPlanRepository;
import com.orderandpay.repository.TableRepository;
import com.orderandpay.security.TenantContext;
import com.orderandpay.websocket.OrderEventPublisher;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/floor-plans")
@RequiredArgsConstructor
@Slf4j
public class FloorPlanController {

    private final FloorPlanRepository floorPlanRepository;
    private final TableRepository     tableRepository;
    private final OrderEventPublisher eventPublisher;

    @GetMapping
    public List<FloorPlan> list() {
        return floorPlanRepository.findByRestaurantIdOrderBySortOrder(
                TenantContext.getCurrentTenant());
    }

    @GetMapping("/{id}")
    public ResponseEntity<FloorPlan> get(@PathVariable UUID id) {
        return floorPlanRepository.findById(id)
                .filter(fp -> fp.getRestaurant().getId().equals(TenantContext.getCurrentTenant()))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/tables")
    public List<RestaurantTable> tables(@PathVariable UUID id) {
        return tableRepository.findByFloorPlanIdAndRestaurantId(
                id, TenantContext.getCurrentTenant());
    }

    /**
     * Sauvegarde en masse les positions des tables après un drag & drop.
     * L'éditeur Angular envoie la liste complète des tables avec leur nouvelle
     * position dans la grille.
     */
    @PutMapping("/{id}/tables/positions")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public ResponseEntity<Void> savePositions(
            @PathVariable UUID id,
            @Valid @RequestBody List<TablePositionDto> positions) {

        UUID restaurantId = TenantContext.getCurrentTenant();
        FloorPlan floorPlan = floorPlanRepository.findById(id)
                .filter(fp -> fp.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new IllegalArgumentException("Plan introuvable"));

        boolean hasNewTables = positions.stream().anyMatch(p -> p.tableId() == null);
        log.info("savePositions: {} positions, hasNewTables={}, restaurantId={}", positions.size(), hasNewTables, restaurantId);

        for (TablePositionDto pos : positions) {
            if (pos.tableId() == null) {
                // Nouvelle table — création
                RestaurantTable newTable = RestaurantTable.builder()
                        .restaurant(floorPlan.getRestaurant())
                        .floorPlan(floorPlan)
                        .label(pos.label() != null ? pos.label() : "T?")
                        .capacity(pos.capacity() != null ? pos.capacity() : (short) 4)
                        .shape(pos.shape() != null
                                ? RestaurantTable.TableShape.valueOf(pos.shape())
                                : RestaurantTable.TableShape.RECT)
                        .gridX(pos.x()).gridY(pos.y()).gridW(pos.w()).gridH(pos.h())
                        .status(RestaurantTable.TableStatus.FREE)
                        .qrToken(UUID.randomUUID().toString())
                        .build();
                tableRepository.save(newTable);
            } else {
                tableRepository.findByIdAndRestaurantId(pos.tableId(), restaurantId)
                        .ifPresent(table -> {
                            table.setGridX(pos.x());
                            table.setGridY(pos.y());
                            table.setGridW(pos.w());
                            table.setGridH(pos.h());
                            if (pos.label()    != null) table.setLabel(pos.label());
                            if (pos.capacity() != null) table.setCapacity(pos.capacity());
                            if (pos.shape()    != null) table.setShape(
                                    RestaurantTable.TableShape.valueOf(pos.shape()));
                            tableRepository.save(table);
                        });
            }
        }
        if (hasNewTables) {
            log.info("savePositions: registering afterCommit WS notification for restaurantId={}", restaurantId);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    log.info("savePositions: afterCommit firing TABLES_UPDATED for restaurantId={}", restaurantId);
                    eventPublisher.notifyTables(restaurantId, OrderEventDto.tablesUpdated(restaurantId));
                }
            });
        }

        return ResponseEntity.noContent().build();
    }

    /** Met à jour le statut d'une table (ex: DIRTY → FREE après nettoyage). */
    @PatchMapping("/tables/{tableId}/status")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','KITCHEN')")
    public ResponseEntity<Void> updateTableStatus(
            @PathVariable UUID tableId,
            @RequestParam String status) {

        RestaurantTable.TableStatus newStatus = RestaurantTable.TableStatus.valueOf(status.toUpperCase());
        tableRepository.findByIdAndRestaurantId(tableId, TenantContext.getCurrentTenant())
                .ifPresent(table -> {
                    table.setStatus(newStatus);
                    tableRepository.save(table);
                });
        return ResponseEntity.noContent().build();
    }

    /** Supprime une table et notifie les clients en temps réel. */
    @DeleteMapping("/tables/{tableId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public ResponseEntity<Void> deleteTable(@PathVariable UUID tableId) {
        UUID restaurantId = TenantContext.getCurrentTenant();
        tableRepository.findByIdAndRestaurantId(tableId, restaurantId)
                .ifPresent(table -> {
                    tableRepository.delete(table);
                    log.info("deleteTable: registering afterCommit WS notification for tableId={}, restaurantId={}", tableId, restaurantId);
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            log.info("deleteTable: afterCommit firing TABLES_UPDATED for restaurantId={}", restaurantId);
                            eventPublisher.notifyTables(restaurantId,
                                    OrderEventDto.tablesUpdated(restaurantId));
                        }
                    });
                });
        return ResponseEntity.noContent().build();
    }
}

package com.orderandpay.controller;

import com.orderandpay.dto.TablePositionDto;
import com.orderandpay.entity.FloorPlan;
import com.orderandpay.entity.RestaurantTable;
import com.orderandpay.repository.FloorPlanRepository;
import com.orderandpay.repository.TableRepository;
import com.orderandpay.security.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/floor-plans")
@RequiredArgsConstructor
public class FloorPlanController {

    private final FloorPlanRepository floorPlanRepository;
    private final TableRepository     tableRepository;

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
        for (TablePositionDto pos : positions) {
            tableRepository.findByIdAndRestaurantId(pos.tableId(), restaurantId)
                    .ifPresent(table -> {
                        table.setGridX(pos.x());
                        table.setGridY(pos.y());
                        table.setGridW(pos.w());
                        table.setGridH(pos.h());
                        tableRepository.save(table);
                    });
        }
        return ResponseEntity.noContent().build();
    }
}

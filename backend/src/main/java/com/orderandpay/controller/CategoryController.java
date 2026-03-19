package com.orderandpay.controller;

import com.orderandpay.dto.CategorySaveDto;
import com.orderandpay.entity.Category;
import com.orderandpay.entity.Restaurant;
import com.orderandpay.repository.CategoryRepository;
import com.orderandpay.repository.RestaurantRepository;
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
@RequestMapping("/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final RestaurantRepository restaurantRepository;

    @GetMapping
    public List<Category> list() {
        return categoryRepository.findByRestaurantIdOrderBySortOrder(TenantContext.getCurrentTenant());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public ResponseEntity<Category> create(@Valid @RequestBody CategorySaveDto dto) {
        Restaurant restaurant = restaurantRepository.getReferenceById(TenantContext.getCurrentTenant());
        Category cat = new Category();
        cat.setRestaurant(restaurant);
        cat.setName(dto.name());
        cat.setSortOrder(dto.sortOrder());
        cat.setVisible(true);
        return ResponseEntity.status(201).body(categoryRepository.save(cat));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public ResponseEntity<Category> update(@PathVariable UUID id, @Valid @RequestBody CategorySaveDto dto) {
        return categoryRepository.findById(id)
                .filter(c -> c.getRestaurant().getId().equals(TenantContext.getCurrentTenant()))
                .map(c -> {
                    c.setName(dto.name());
                    c.setSortOrder(dto.sortOrder());
                    return ResponseEntity.ok(categoryRepository.save(c));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        var cat = categoryRepository.findById(id)
                .filter(c -> c.getRestaurant().getId().equals(TenantContext.getCurrentTenant()));
        if (cat.isEmpty()) return ResponseEntity.notFound().build();
        categoryRepository.delete(cat.get());
        return ResponseEntity.noContent().build();
    }
}

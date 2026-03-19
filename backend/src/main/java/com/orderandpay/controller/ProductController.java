package com.orderandpay.controller;

import com.orderandpay.dto.ProductSaveDto;
import com.orderandpay.entity.Category;
import com.orderandpay.entity.Product;
import com.orderandpay.entity.Restaurant;
import com.orderandpay.repository.CategoryRepository;
import com.orderandpay.repository.ProductRepository;
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
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductRepository    productRepository;
    private final CategoryRepository   categoryRepository;
    private final RestaurantRepository restaurantRepository;

    @GetMapping
    public List<Product> list() {
        return productRepository.findByRestaurantIdOrderBySortOrder(TenantContext.getCurrentTenant());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public ResponseEntity<Product> create(@Valid @RequestBody ProductSaveDto dto) {
        UUID restaurantId = TenantContext.getCurrentTenant();
        Restaurant restaurant = restaurantRepository.getReferenceById(restaurantId);

        Product product = new Product();
        product.setRestaurant(restaurant);
        product.setName(dto.name());
        product.setDescription(dto.description());
        product.setPriceHt(dto.priceHt());
        product.setVatRate(dto.vatRate());
        product.setCostPrice(dto.costPrice());
        product.setUpsell(dto.upsell());
        product.setAvailable(dto.available());
        product.setSortOrder(dto.sortOrder());

        if (dto.categoryId() != null) {
            categoryRepository.findById(dto.categoryId())
                    .filter(c -> c.getRestaurant().getId().equals(restaurantId))
                    .ifPresent(product::setCategory);
        }

        return ResponseEntity.status(201).body(productRepository.save(product));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public ResponseEntity<Product> update(@PathVariable UUID id, @Valid @RequestBody ProductSaveDto dto) {
        UUID restaurantId = TenantContext.getCurrentTenant();
        return productRepository.findByIdAndRestaurantId(id, restaurantId)
                .map(product -> {
                    product.setName(dto.name());
                    product.setDescription(dto.description());
                    product.setPriceHt(dto.priceHt());
                    product.setVatRate(dto.vatRate());
                    product.setCostPrice(dto.costPrice());
                    product.setUpsell(dto.upsell());
                    product.setAvailable(dto.available());
                    product.setSortOrder(dto.sortOrder());

                    if (dto.categoryId() != null) {
                        categoryRepository.findById(dto.categoryId())
                                .filter(c -> c.getRestaurant().getId().equals(restaurantId))
                                .ifPresent(product::setCategory);
                    } else {
                        product.setCategory(null);
                    }

                    return ResponseEntity.ok(productRepository.save(product));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        var product = productRepository.findByIdAndRestaurantId(id, TenantContext.getCurrentTenant());
        if (product.isEmpty()) return ResponseEntity.notFound().build();
        productRepository.delete(product.get());
        return ResponseEntity.noContent().build();
    }
}

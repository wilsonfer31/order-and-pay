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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
import java.util.UUID;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    @Value("${app.uploads.path:./uploads}")
    private String uploadsPath;

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
    @CacheEvict(value = "menu", allEntries = true)
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
        product.setImageUrl(dto.imageUrl());

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
    @CacheEvict(value = "menu", allEntries = true)
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
                    product.setImageUrl(dto.imageUrl());

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
    @CacheEvict(value = "menu", allEntries = true)
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        var product = productRepository.findByIdAndRestaurantId(id, TenantContext.getCurrentTenant());
        if (product.isEmpty()) return ResponseEntity.notFound().build();
        productRepository.delete(product.get());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/image")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @CacheEvict(value = "menu", allEntries = true)
    public ResponseEntity<Map<String, String>> uploadImage(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) throws IOException {

        UUID restaurantId = TenantContext.getCurrentTenant();
        Product product = productRepository.findByIdAndRestaurantId(id, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().build();
        }

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
}

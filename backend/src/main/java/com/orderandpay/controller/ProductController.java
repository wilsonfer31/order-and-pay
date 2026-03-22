package com.orderandpay.controller;

import com.orderandpay.dto.ProductOptionDto;
import com.orderandpay.dto.ProductSaveDto;
import com.orderandpay.entity.*;
import com.orderandpay.repository.CategoryRepository;
import com.orderandpay.repository.ProductRepository;
import com.orderandpay.repository.RestaurantRepository;
import com.orderandpay.security.TenantContext;
import com.orderandpay.service.AuditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import org.springframework.web.multipart.MultipartFile;

import net.coobird.thumbnailator.Thumbnails;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    @Value("${app.uploads.path:./uploads}")
    private String uploadsPath;

    private final ProductRepository    productRepository;
    private final CategoryRepository   categoryRepository;
    private final RestaurantRepository restaurantRepository;
    private final AuditService         auditService;

    @GetMapping
    public List<Product> list() {
        return productRepository.findByRestaurantIdOrderBySortOrder(TenantContext.getCurrentTenant());
    }

    @GetMapping("/{id}/options")
    @Transactional(readOnly = true)
    public ResponseEntity<List<ProductOptionDto>> getOptions(@PathVariable UUID id) {
        UUID restaurantId = TenantContext.getCurrentTenant();
        return productRepository.findByIdAndRestaurantId(id, restaurantId)
                .map(product -> {
                    List<ProductOptionDto> opts = product.getOptions().stream()
                            .map(opt -> new ProductOptionDto(
                                    opt.getId().toString(),
                                    opt.getName(),
                                    opt.isRequired(),
                                    opt.getMaxChoices(),
                                    opt.getValues().stream()
                                            .map(v -> new ProductOptionDto.ValueDto(
                                                    v.getId().toString(),
                                                    v.getLabel(),
                                                    v.getPriceDeltaHt()
                                            ))
                                            .toList()
                            ))
                            .toList();
                    return ResponseEntity.ok(opts);
                })
                .orElse(ResponseEntity.notFound().build());
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
        applyBasicFields(product, dto, restaurantId);
        applyOptions(product, dto);

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
                    boolean priceChanged = dto.priceHt().compareTo(product.getPriceHt()) != 0;
                    if (priceChanged) {
                        auditService.log(restaurantId, "PRODUCT_PRICE_CHANGED", id,
                                "{\"name\":\"" + product.getName() + "\""
                                + ",\"oldPriceHt\":" + product.getPriceHt()
                                + ",\"newPriceHt\":" + dto.priceHt() + "}");
                    }
                    applyBasicFields(product, dto, restaurantId);
                    applyOptions(product, dto);

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

        // Toujours sauvegarder en JPEG — jamais d'extension arbitraire (protection RCE)
        String filename = java.util.UUID.randomUUID() + ".jpg";

        Path uploadDir = Paths.get(uploadsPath, "images");
        Files.createDirectories(uploadDir);

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

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void applyBasicFields(Product product, ProductSaveDto dto, UUID restaurantId) {
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
    }

    /**
     * Met à jour les options du produit en préservant les UUIDs existants.
     * Si dto.options() est null, les options existantes sont conservées intactes.
     * Les options/valeurs avec un {@code id} connu sont mises à jour sur place
     * (UUID préservé), les autres sont créées, et celles absentes du DTO sont supprimées.
     */
    private void applyOptions(Product product, ProductSaveDto dto) {
        if (dto.options() == null) return;

        // Index des options existantes par UUID
        Map<UUID, ProductOption> existingOpts = product.getOptions().stream()
                .collect(Collectors.toMap(ProductOption::getId, o -> o));

        // UUIDs à conserver (ceux présents dans le DTO)
        Set<UUID> keepOptIds = dto.options().stream()
                .map(o -> safeUUID(o.id()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        product.getOptions().removeIf(o -> !keepOptIds.contains(o.getId()));

        for (ProductSaveDto.OptionDto optDto : dto.options()) {
            UUID optId = safeUUID(optDto.id());
            ProductOption opt = (optId != null) ? existingOpts.get(optId) : null;

            if (opt == null) {
                opt = new ProductOption();
                opt.setProduct(product);
                product.getOptions().add(opt);
            }
            opt.setName(optDto.name());
            opt.setRequired(optDto.required());
            opt.setMaxChoices(optDto.maxChoices() > 0 ? optDto.maxChoices() : 1);

            if (optDto.values() != null) {
                applyValues(opt, optDto.values());
            }
        }
    }

    private void applyValues(ProductOption opt, List<ProductSaveDto.ValueDto> valueDtos) {
        Map<UUID, ProductOptionValue> existingVals = opt.getValues().stream()
                .collect(Collectors.toMap(ProductOptionValue::getId, v -> v));

        Set<UUID> keepValIds = valueDtos.stream()
                .map(v -> safeUUID(v.id()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        opt.getValues().removeIf(v -> !keepValIds.contains(v.getId()));

        for (ProductSaveDto.ValueDto valDto : valueDtos) {
            UUID valId = safeUUID(valDto.id());
            ProductOptionValue val = (valId != null) ? existingVals.get(valId) : null;

            if (val == null) {
                val = new ProductOptionValue();
                val.setOption(opt);
                opt.getValues().add(val);
            }
            val.setLabel(valDto.label());
            val.setPriceDeltaHt(valDto.priceDeltaHt() != null ? valDto.priceDeltaHt() : BigDecimal.ZERO);
        }
    }

    private static UUID safeUUID(String s) {
        if (s == null || s.isBlank()) return null;
        try { return UUID.fromString(s); } catch (IllegalArgumentException e) { return null; }
    }
}

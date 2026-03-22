package com.orderandpay.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ProductSaveDto(
    @NotBlank @Size(max = 150) String name,
    @Size(max = 500) String description,
    UUID categoryId,
    @NotNull @Positive BigDecimal priceHt,
    @NotNull BigDecimal vatRate,
    BigDecimal costPrice,
    boolean upsell,
    boolean available,
    short sortOrder,
    String imageUrl,
    /** Liste des options du plat. Si null, les options existantes sont conservées.
     *  Si non-null (même vide), remplace toutes les options existantes. */
    @Valid List<OptionDto> options
) {
    public record OptionDto(
            String id,   // UUID existant — null pour une nouvelle option
            @NotBlank @Size(max = 100) String name,
            boolean required,
            short maxChoices,
            @Valid List<ValueDto> values
    ) {}

    public record ValueDto(
            String id,   // UUID existante — null pour une nouvelle valeur
            @NotBlank @Size(max = 80) String label,
            BigDecimal priceDeltaHt
    ) {}
}

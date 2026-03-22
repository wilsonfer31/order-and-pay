package com.orderandpay.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
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
    String imageUrl
) {}

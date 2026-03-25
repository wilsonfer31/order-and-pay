package com.orderandpay.dto;

import java.math.BigDecimal;
import java.util.List;

public record MenuResponseDto(
        String tableId,
        String tableLabel,
        String restaurantName,
        List<CategoryDto> categories,
        List<ProductDto>  products
) {
    public record CategoryDto(
            String id, String name, String imageUrl, int sortOrder, String destination
    ) {}

    public record ProductDto(
            String     id,
            String     categoryId,
            String     name,
            String     description,
            String     imageUrl,
            BigDecimal priceHt,
            BigDecimal priceTtc,
            BigDecimal vatRate,
            String[]   allergens,
            boolean    available,
            boolean    upsell,
            List<OptionDto> options
    ) {}

    public record OptionDto(
            String         id,
            String         name,
            boolean        required,
            short          maxChoices,
            List<ValueDto> values
    ) {}

    public record ValueDto(
            String     id,
            String     label,
            BigDecimal priceDeltaHt
    ) {}
}

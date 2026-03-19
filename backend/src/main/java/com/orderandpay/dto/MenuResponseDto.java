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
            String id, String name, String imageUrl, int sortOrder
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
            boolean    upsell
    ) {}
}

package com.orderandpay.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProductOptionDto(
        String         id,
        String         name,
        boolean        required,
        short          maxChoices,
        List<ValueDto> values
) {
    public record ValueDto(
            String     id,
            String     label,
            BigDecimal priceDeltaHt
    ) {}
}

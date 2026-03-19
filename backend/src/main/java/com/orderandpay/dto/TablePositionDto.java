package com.orderandpay.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record TablePositionDto(
        @NotNull UUID  tableId,
        @Min(0)  short x,
        @Min(0)  short y,
        @Min(1)  short w,
        @Min(1)  short h
) {}

package com.orderandpay.dto;

import jakarta.validation.constraints.Min;
import java.util.UUID;

public record TablePositionDto(
        UUID   tableId,   // null = nouvelle table à créer
        @Min(0) short x,
        @Min(0) short y,
        @Min(1) short w,
        @Min(1) short h,
        String label,
        Short  capacity,
        String shape
) {}

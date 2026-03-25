package com.orderandpay.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CategorySaveDto(
    @NotBlank @Size(max = 100) String name,
    short sortOrder,
    /** KITCHEN (défaut) ou BAR */
    @Pattern(regexp = "KITCHEN|BAR") String destination
) {}

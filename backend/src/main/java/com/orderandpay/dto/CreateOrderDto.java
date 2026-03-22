package com.orderandpay.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CreateOrderDto(
        @NotNull  UUID   tableId,
        String           tableToken,  // QR token — requis pour les commandes CLIENT_APP
        String           source,      // WAITER | CLIENT_APP | KIOSK
        Short            guestCount,
        @Size(max = 500) String notes,
        @NotEmpty @Valid
        List<LineDto>    lines
) {
    public record LineDto(
            @NotNull String productId,
            @Positive @Max(99) short quantity,
            @Size(max = 300) String notes
    ) {}
}

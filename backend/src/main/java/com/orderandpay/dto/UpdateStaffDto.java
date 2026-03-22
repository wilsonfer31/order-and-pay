package com.orderandpay.dto;

import com.orderandpay.entity.User;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateStaffDto(
    @Size(max = 80) String    firstName,
    @Size(max = 80) String    lastName,
    @NotNull        User.Role role,
    // Laisser vide pour ne pas changer le mot de passe
    @Size(min = 8, max = 100) String password
) {}

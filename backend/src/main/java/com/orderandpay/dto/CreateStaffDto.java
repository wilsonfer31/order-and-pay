package com.orderandpay.dto;

import com.orderandpay.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateStaffDto(
    @NotBlank @Email                     String    email,
    @NotBlank @Size(min = 8, max = 100)  String    password,
    @Size(max = 80)                      String    firstName,
    @Size(max = 80)                      String    lastName,
    @NotNull                             User.Role role
) {}

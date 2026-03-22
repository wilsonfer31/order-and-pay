package com.orderandpay.dto;

import java.time.Instant;
import java.util.UUID;

public record StaffDto(
    UUID    id,
    String  email,
    String  firstName,
    String  lastName,
    String  role,
    boolean active,
    Instant lastLoginAt,
    Instant createdAt
) {}

package com.orderandpay.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ProfitabilityReportDto(
        LocalDate from,
        LocalDate to,
        int    totalOrders,
        int    totalCovers,
        BigDecimal revenueHt,
        BigDecimal revenueTtc,
        BigDecimal totalVat55,
        BigDecimal totalVat10,
        BigDecimal totalVat20,
        BigDecimal costMaterials,
        BigDecimal grossMargin,
        BigDecimal marginPercent,
        BigDecimal avgBasketTtc
) {}

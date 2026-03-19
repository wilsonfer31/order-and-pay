package com.orderandpay.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Gestion fine des taxes françaises (TVA 5.5 / 10 / 20).
 * Toute la logique fiscale est centralisée ici pour faciliter
 * les audits comptables et les évolutions réglementaires.
 */
@Service
@RequiredArgsConstructor
public class TaxService {

    private static final BigDecimal RATE_055 = new BigDecimal("5.5");
    private static final BigDecimal RATE_10  = new BigDecimal("10");
    private static final BigDecimal RATE_20  = new BigDecimal("20");

    private static final List<BigDecimal> VALID_RATES = List.of(RATE_055, RATE_10, RATE_20);

    // ── Calculs unitaires ─────────────────────────────────────────────────────

    public BigDecimal computeTtcFromHt(BigDecimal priceHt, BigDecimal vatRate) {
        validateRate(vatRate);
        return priceHt.multiply(BigDecimal.ONE.add(vatRate.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP)))
                      .setScale(4, RoundingMode.HALF_UP);
    }

    public BigDecimal computeHtFromTtc(BigDecimal priceTtc, BigDecimal vatRate) {
        validateRate(vatRate);
        return priceTtc.divide(BigDecimal.ONE.add(vatRate.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP)),
                               4, RoundingMode.HALF_UP);
    }

    public BigDecimal computeVatAmount(BigDecimal priceHt, BigDecimal vatRate) {
        validateRate(vatRate);
        return priceHt.multiply(vatRate.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP))
                      .setScale(4, RoundingMode.HALF_UP);
    }

    // ── Décomposition TVA d'une commande ─────────────────────────────────────

    public TaxBreakdown breakdown(BigDecimal totalHt, BigDecimal vatRate) {
        BigDecimal vat = computeVatAmount(totalHt, vatRate);
        return new TaxBreakdown(totalHt, vat, totalHt.add(vat), vatRate);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    public void validateRate(BigDecimal rate) {
        boolean valid = VALID_RATES.stream()
                .anyMatch(r -> r.compareTo(rate) == 0);
        if (!valid) {
            throw new IllegalArgumentException(
                    "Taux de TVA invalide : " + rate + ". Valeurs acceptées : 5.5, 10, 20");
        }
    }

    public BigDecimal defaultRateForCategory(String categoryCode) {
        return switch (categoryCode.toUpperCase()) {
            case "FOOD_BASIC"    -> RATE_055;   // épicerie, produits de base
            case "FOOD_PREPARED",
                 "BEVERAGE_SOFT" -> RATE_10;    // restauration, boissons sans alcool
            case "ALCOHOL",
                 "TOBACCO",
                 "MISC"          -> RATE_20;
            default              -> RATE_10;    // restauration par défaut
        };
    }

    public record TaxBreakdown(
            BigDecimal amountHt,
            BigDecimal vatAmount,
            BigDecimal amountTtc,
            BigDecimal vatRate
    ) {}
}

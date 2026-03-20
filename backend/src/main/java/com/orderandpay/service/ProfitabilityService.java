package com.orderandpay.service;

import com.orderandpay.dto.ProfitabilityReportDto;
import com.orderandpay.entity.Order;
import com.orderandpay.entity.OrderLine;
import com.orderandpay.repository.DailyStatsRepository;
import com.orderandpay.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * Calcule la rentabilité : CA HT/TTC, coût matière, marge brute.
 * Peut opérer sur un range de dates ou depuis les agrégats daily_stats.
 */
@Service
@RequiredArgsConstructor
public class ProfitabilityService {

    private final OrderRepository       orderRepository;
    private final DailyStatsRepository  dailyStatsRepository;

    // ── Rapport en temps réel (J en cours) ───────────────────────────────────

    public ProfitabilityReportDto todayReport(UUID restaurantId, ZoneId tz) {
        LocalDate today = LocalDate.now(tz);
        return buildReport(restaurantId, today, today);
    }

    // ── Rapport sur période ───────────────────────────────────────────────────

    public ProfitabilityReportDto periodReport(UUID restaurantId, LocalDate from, LocalDate to, ZoneId tz) {
        return buildReport(restaurantId, from, to);
    }

    // ── Implémentation ────────────────────────────────────────────────────────

    private ProfitabilityReportDto buildReport(UUID restaurantId, LocalDate from, LocalDate to) {
        ZoneId utc = ZoneId.of("UTC");
        Instant fromInstant = from.atStartOfDay(utc).toInstant();
        Instant toInstant   = to.plusDays(1).atStartOfDay(utc).toInstant();
        List<Order> orders = orderRepository.findPaidOrdersByRestaurantAndDateRange(
                restaurantId, fromInstant, toInstant);

        BigDecimal revenueHt       = BigDecimal.ZERO;
        BigDecimal revenueTtc      = BigDecimal.ZERO;
        BigDecimal costMaterials   = BigDecimal.ZERO;
        BigDecimal totalVat55      = BigDecimal.ZERO;
        BigDecimal totalVat10      = BigDecimal.ZERO;
        BigDecimal totalVat20      = BigDecimal.ZERO;
        int        totalOrders     = orders.size();
        int        totalCovers     = 0;

        for (Order order : orders) {
            revenueHt  = revenueHt .add(order.getTotalHt());
            revenueTtc = revenueTtc.add(order.getTotalTtc());
            totalVat55 = totalVat55.add(order.getTotalVat55());
            totalVat10 = totalVat10.add(order.getTotalVat10());
            totalVat20 = totalVat20.add(order.getTotalVat20());
            if (order.getGuestCount() != null) totalCovers += order.getGuestCount();

            for (OrderLine line : order.getLines()) {
                if (line.getStatus() == OrderLine.LineStatus.CANCELLED) continue;
                if (line.getProduct().getCostPrice() != null) {
                    costMaterials = costMaterials.add(
                            line.getProduct().getCostPrice()
                                .multiply(BigDecimal.valueOf(line.getQuantity()))
                    );
                }
            }
        }

        BigDecimal grossMargin = revenueHt.subtract(costMaterials);
        BigDecimal marginPct = revenueHt.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : grossMargin.divide(revenueHt, 4, RoundingMode.HALF_UP)
                             .multiply(new BigDecimal("100"));

        BigDecimal avgBasket = totalOrders == 0
                ? BigDecimal.ZERO
                : revenueTtc.divide(BigDecimal.valueOf(totalOrders), 2, RoundingMode.HALF_UP);

        return new ProfitabilityReportDto(
                from, to,
                totalOrders, totalCovers,
                revenueHt, revenueTtc,
                totalVat55, totalVat10, totalVat20,
                costMaterials, grossMargin, marginPct,
                avgBasket
        );
    }
}

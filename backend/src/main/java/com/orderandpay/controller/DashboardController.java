package com.orderandpay.controller;

import com.orderandpay.dto.ProfitabilityReportDto;
import com.orderandpay.security.TenantContext;
import com.orderandpay.service.ProfitabilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final ProfitabilityService profitabilityService;
    private final com.orderandpay.repository.OrderRepository orderRepository;

    /** Rapport du jour courant — affiché en temps réel dans le dashboard Angular. */
    @GetMapping("/today")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','CASHIER')")
    public ResponseEntity<?> today(
            @RequestParam(defaultValue = "Europe/Paris") String timezone) {

        ZoneId zone;
        try {
            zone = ZoneId.of(timezone);
        } catch (DateTimeException e) {
            return ResponseEntity.badRequest().body("Timezone invalide: " + timezone);
        }

        return ResponseEntity.ok(
                profitabilityService.todayReport(TenantContext.getCurrentTenant(), zone));
    }

    /** CA journalier sur N jours — alimente le graphique du dashboard. */
    @GetMapping("/daily")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','CASHIER')")
    public List<Map<String, Object>> daily(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "Europe/Paris") String timezone) {

        ZoneId zone = ZoneId.of(timezone);
        LocalDate today = LocalDate.now(zone);
        LocalDate start = today.minusDays(days - 1);

        Instant from = start.atStartOfDay(zone).toInstant();
        Instant to   = today.plusDays(1).atStartOfDay(zone).toInstant();

        // Charge toutes les commandes payées sur la période en une requête
        var orders = orderRepository.findPaidOrdersByRestaurantAndDateRange(
                TenantContext.getCurrentTenant(), from, to);

        // Agrège par jour
        var map = new java.util.TreeMap<LocalDate, java.math.BigDecimal>();
        for (LocalDate d = start; !d.isAfter(today); d = d.plusDays(1)) {
            map.put(d, java.math.BigDecimal.ZERO);
        }
        for (var order : orders) {
            LocalDate day = order.getPaidAt().atZone(zone).toLocalDate();
            map.merge(day, order.getTotalTtc(), java.math.BigDecimal::add);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        map.forEach((date, ttc) -> {
            var entry = new java.util.LinkedHashMap<String, Object>();
            entry.put("date",       date.toString());
            entry.put("revenueTtc", ttc);
            result.add(entry);
        });
        return result;
    }

    /** Rapport sur période personnalisée. */
    @GetMapping("/report")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ResponseEntity<?> report(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "Europe/Paris") String timezone) {

        ZoneId zone;
        try {
            zone = ZoneId.of(timezone);
        } catch (DateTimeException e) {
            return ResponseEntity.badRequest().body("Timezone invalide: " + timezone);
        }

        return ResponseEntity.ok(
                profitabilityService.periodReport(TenantContext.getCurrentTenant(), from, to, zone));
    }
}

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
import java.time.LocalDate;
import java.time.ZoneId;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final ProfitabilityService profitabilityService;

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

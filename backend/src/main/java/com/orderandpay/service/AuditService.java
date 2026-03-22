package com.orderandpay.service;

import com.orderandpay.entity.AuditLog;
import com.orderandpay.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Enregistre une action sensible avec l'acteur résolu automatiquement
     * depuis le contexte Spring Security (employé connecté ou "client").
     */
    public void log(UUID restaurantId, String action, UUID entityId, String details) {
        log(restaurantId, resolveActor(), action, entityId, details);
    }

    /**
     * Enregistre une action avec un acteur explicite (ex: "client" pour le mobile).
     */
    public void log(UUID restaurantId, String actor, String action, UUID entityId, String details) {
        try {
            auditLogRepository.save(AuditLog.builder()
                    .restaurantId(restaurantId)
                    .actor(actor)
                    .action(action)
                    .entityId(entityId)
                    .details(details)
                    .build());
            log.info("[AUDIT] actor={} action={} entityId={} details={}", actor, action, entityId, details);
        } catch (Exception e) {
            // L'audit ne doit jamais faire échouer l'action métier
            log.error("[AUDIT] Échec de l'enregistrement : actor={} action={} entityId={}", actor, action, entityId, e);
        }
    }

    private String resolveActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return "client";
    }
}

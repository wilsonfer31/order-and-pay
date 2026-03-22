package com.orderandpay.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limite le taux de requêtes sur les endpoints sensibles.
 *
 * Règles par IP :
 *  - POST /auth/login     →  5 tentatives / minute  (anti brute-force)
 *  - POST /public/orders  → 10 commandes  / minute  (anti-spam commandes)
 *  - GET  /public/**      → 60 requêtes   / minute  (navigation menu)
 */
@Component
@Order(10)
public class RateLimitingFilter extends OncePerRequestFilter {

    /** Buckets dédiés aux tentatives de login (limite stricte anti brute-force). */
    private final ConcurrentHashMap<String, Bucket> loginBuckets   = new ConcurrentHashMap<>();

    /** Buckets dédiés aux soumissions de commandes (limite stricte). */
    private final ConcurrentHashMap<String, Bucket> orderBuckets   = new ConcurrentHashMap<>();

    /** Buckets pour les appels de navigation générale (lecture menu, tables…). */
    private final ConcurrentHashMap<String, Bucket> generalBuckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path   = request.getServletPath();
        String method = request.getMethod();
        String ip     = resolveClientIp(request);
        boolean allowed;

        if ("POST".equalsIgnoreCase(method) && path.equals("/auth/login")) {
            allowed = loginBuckets
                    .computeIfAbsent(ip, k -> buildBucket(5, Duration.ofMinutes(1)))
                    .tryConsume(1);
        } else if (!path.startsWith("/public/")) {
            filterChain.doFilter(request, response);
            return;
        } else if ("POST".equalsIgnoreCase(method) && path.equals("/public/orders")) {
            allowed = orderBuckets
                    .computeIfAbsent(ip, k -> buildBucket(10, Duration.ofMinutes(1)))
                    .tryConsume(1);
        } else {
            allowed = generalBuckets
                    .computeIfAbsent(ip, k -> buildBucket(60, Duration.ofMinutes(1)))
                    .tryConsume(1);
        }

        if (!allowed) {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"Trop de requêtes. Réessayez dans une minute.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private Bucket buildBucket(int capacity, Duration period) {
        Bandwidth limit = Bandwidth.classic(capacity, Refill.intervally(capacity, period));
        return Bucket.builder().addLimit(limit).build();
    }

    /**
     * Résout l'IP réelle du client en tenant compte des proxys inverses
     * (header X-Forwarded-For envoyé par nginx).
     */
    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

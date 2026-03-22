package com.orderandpay.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class JwtService {

    /** Secrets par défaut connus — refusés au démarrage pour forcer la configuration. */
    private static final Set<String> KNOWN_WEAK_SECRETS = Set.of(
            "your-256-bit-secret-key-change-in-production-please",
            "change-me-in-production-256-bit-secret",
            "dev-only-secret-do-not-use-in-production"
    );

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    @PostConstruct
    public void validateSecret() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "[SÉCURITÉ] app.jwt.secret est vide. " +
                    "Définissez JWT_SECRET avec un secret fort (≥ 32 caractères).");
        }
        if (KNOWN_WEAK_SECRETS.contains(secret.trim())) {
            throw new IllegalStateException(
                    "[SÉCURITÉ] app.jwt.secret utilise la valeur par défaut. " +
                    "Définissez JWT_SECRET avec un secret fort avant de démarrer. " +
                    "Générez-en un : openssl rand -base64 32");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "[SÉCURITÉ] app.jwt.secret est trop court (" +
                    secret.getBytes(StandardCharsets.UTF_8).length +
                    " octets). Minimum requis : 32 octets (256 bits).");
        }
    }

    public String generateToken(UserDetails user, UUID restaurantId) {
        return Jwts.builder()
                .subject(user.getUsername())
                .claims(Map.of(
                        "restaurantId", restaurantId.toString(),
                        "roles", user.getAuthorities().stream()
                                     .map(a -> a.getAuthority()).toList()
                ))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getKey())
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public UUID extractRestaurantId(String token) {
        String id = extractClaim(token, c -> c.get("restaurantId", String.class));
        return id != null ? UUID.fromString(id) : null;
    }

    public boolean isTokenValid(String token) {
        try {
            return !extractClaim(token, Claims::getExpiration).before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        return resolver.apply(
                Jwts.parser().verifyWith(getKey()).build()
                    .parseSignedClaims(token).getPayload());
    }

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}

package com.orderandpay.security;

import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService         jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String header = req.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(req, res);
            return;
        }

        String token = header.substring(7);
        try {
            String username = jwtService.extractUsername(token);
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                var userDetails = userDetailsService.loadUserByUsername(username);
                if (jwtService.isTokenValid(token)) {
                    var auth = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    MDC.put("username", username);
                }
            }
            // Origine de la requête : admin-web, mobile-app ou API directe
            String clientApp = req.getHeader("X-Client-App");
            if (clientApp != null && !clientApp.isBlank()) {
                MDC.put("clientApp", clientApp);
            }
        } catch (ExpiredJwtException e) {
            // Token expiré — cas normal, l'utilisateur doit se reconnecter
            log.debug("JWT expiré pour la requête {} {}", req.getMethod(), req.getRequestURI());
        } catch (Exception e) {
            // Signature invalide, token malformé, algorithme inattendu…
            // Peut indiquer une tentative de falsification ou une mauvaise config.
            log.warn("Erreur JWT inattendue sur {} {} — {} : {}",
                    req.getMethod(), req.getRequestURI(),
                    e.getClass().getSimpleName(), e.getMessage());
        }
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove("username");
            MDC.remove("clientApp");
        }
    }
}

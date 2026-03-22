package com.orderandpay.websocket;

import com.orderandpay.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class WsAuthInterceptor implements ChannelInterceptor {

    private final JwtService         jwtService;
    private final UserDetailsService userDetailsService;

    /**
     * Topics réservés au staff authentifié.
     * Le mobile (anonyme) n'a accès qu'à /topic/client/** et /topic/tables/**.
     */
    private static final java.util.List<String> STAFF_TOPIC_PREFIXES = java.util.List.of(
            "/topic/kitchen/",
            "/topic/floor/",
            "/topic/dashboard/"
    );

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null) return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                // Connexions anonymes autorisées (app mobile publique)
                log.debug("WS CONNECT sans token JWT — connexion anonyme acceptée");
                return message;
            }

            String token    = authHeader.substring(7);
            String username = jwtService.extractUsername(token);

            if (username != null && jwtService.isTokenValid(token)) {
                var userDetails = userDetailsService.loadUserByUsername(username);
                var auth = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                accessor.setUser(auth);
            } else {
                throw new org.springframework.security.access.AccessDeniedException("Token invalide");
            }
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            boolean isStaffTopic = destination != null && STAFF_TOPIC_PREFIXES.stream()
                    .anyMatch(destination::startsWith);

            if (isStaffTopic && accessor.getUser() == null) {
                log.warn("WS SUBSCRIBE refusé sur {} — connexion anonyme", destination);
                throw new org.springframework.security.access.AccessDeniedException(
                        "Authentification requise pour ce topic");
            }
        }

        return message;
    }
}

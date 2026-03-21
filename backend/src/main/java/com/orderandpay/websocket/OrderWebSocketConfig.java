package com.orderandpay.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
public class OrderWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WsAuthInterceptor wsAuthInterceptor;

    public OrderWebSocketConfig(WsAuthInterceptor wsAuthInterceptor) {
        this.wsAuthInterceptor = wsAuthInterceptor;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Broker in-memory ; remplacer par RabbitMQ/Redis en production haute dispo
        registry.enableSimpleBroker(
                "/topic/kitchen",   // → écrans cuisine
                "/topic/floor",     // → tablettes salle
                "/topic/client",    // → app mobile client
                "/topic/dashboard", // → dashboard admin
                "/topic/tables"     // → statuts tables temps réel (public)
        );
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Intercepteur JWT : valide le token avant toute connexion
        registration.interceptors(wsAuthInterceptor);
    }
}

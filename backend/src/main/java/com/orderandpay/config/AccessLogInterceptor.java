package com.orderandpay.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Log une ligne par requête HTTP après traitement complet.
 * À ce stade, JwtAuthFilter a déjà enrichi le MDC avec username et clientApp.
 *
 * Format : METHOD /path | status | user | client | requestId
 */
@Slf4j
@Component
public class AccessLogInterceptor implements HandlerInterceptor {

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler,
                                Exception ex) {

        String method    = request.getMethod();
        String path      = request.getRequestURI();
        int    status    = response.getStatus();
        String user      = MDC.get("username");
        String client    = MDC.get("clientApp");
        String requestId = MDC.get("requestId");

        if (status >= 500) {
            log.error("{} {} → {} | user={} client={} requestId={}",
                    method, path, status,
                    user != null ? user : "anonymous",
                    client != null ? client : "direct",
                    requestId);
        } else if (status >= 400) {
            log.warn("{} {} → {} | user={} client={} requestId={}",
                    method, path, status,
                    user != null ? user : "anonymous",
                    client != null ? client : "direct",
                    requestId);
        } else {
            log.debug("{} {} → {} | user={} client={} requestId={}",
                    method, path, status,
                    user != null ? user : "anonymous",
                    client != null ? client : "direct",
                    requestId);
        }
    }
}

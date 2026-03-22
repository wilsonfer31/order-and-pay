package com.orderandpay.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Injecte un identifiant de requête unique dans le MDC Logback.
 *
 * - Lit X-Request-Id s'il est fourni par nginx, sinon en génère un.
 * - Propage le requestId dans la réponse pour corrélation côté client.
 * - Nettoie le MDC après chaque requête (ThreadLocal).
 */
@Component
@Order(1)
public class MdcFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String MDC_REQUEST_ID    = "requestId";
    public static final String MDC_METHOD        = "method";
    public static final String MDC_PATH          = "path";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }

        MDC.put(MDC_REQUEST_ID, requestId);
        MDC.put(MDC_METHOD,     request.getMethod());
        MDC.put(MDC_PATH,       request.getRequestURI());
        response.setHeader(REQUEST_ID_HEADER, requestId);

        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_REQUEST_ID);
            MDC.remove(MDC_METHOD);
            MDC.remove(MDC_PATH);
        }
    }
}

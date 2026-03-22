package com.orderandpay.controller;

import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler({ BadCredentialsException.class, DisabledException.class, LockedException.class })
    public ResponseEntity<Map<String, String>> handleAuthError(RuntimeException ex) {
        String message = ex instanceof DisabledException  ? "Compte désactivé."
                       : ex instanceof LockedException    ? "Compte verrouillé."
                       : "Email ou mot de passe incorrect.";
        return ResponseEntity.status(401).body(Map.of("message", message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Bad request: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
        log.warn("Conflict: {}", ex.getMessage());
        return ResponseEntity.status(409).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .findFirst()
                .orElse("Données invalides");
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException ex) {
        String user      = MDC.get("username");
        String client    = MDC.get("clientApp");
        String method    = MDC.get("method");
        String path      = MDC.get("path");
        String requestId = MDC.get("requestId");
        log.error("Unexpected error | user={} client={} {} {} requestId={}",
                user != null ? user : "anonymous",
                client != null ? client : "unknown",
                method, path, requestId, ex);
        return ResponseEntity.status(500).body(Map.of("message", "Erreur interne du serveur"));
    }
}

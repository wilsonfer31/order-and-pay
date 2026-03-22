package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    /** Username de l'employé connecté, ou "client" pour les actions du client mobile. */
    @Column(nullable = false, length = 150)
    private String actor;

    /** Type d'action : ORDER_CANCELLED, ORDER_STATUS_CHANGED, PRODUCT_UPDATED… */
    @Column(nullable = false, length = 100)
    private String action;

    /** ID de l'entité concernée (commande, produit…). */
    @Column(name = "entity_id")
    private UUID entityId;

    /** Données contextuelles en JSON (ex: ancien prix, nouveau statut…). */
    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "restaurants")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Restaurant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    /** Clé unique du tenant — utilisée dans tous les filtrages. */
    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    private String address;

    @Column(length = 30)
    private String phone;

    @Column(length = 150)
    private String email;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(length = 3)
    @Builder.Default
    private String currency = "EUR";

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String timezone = "Europe/Paris";

    @Column(length = 20)
    private String siret;

    @Column(name = "tva_intra", length = 20)
    private String tvaIntra;

    @Column(name = "subscription_plan", length = 30)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SubscriptionPlan subscriptionPlan = SubscriptionPlan.STARTER;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public enum SubscriptionPlan { STARTER, PRO, ENTERPRISE }
}

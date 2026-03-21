package com.orderandpay.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tables")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RestaurantTable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_plan_id")
    private FloorPlan floorPlan;

    @Column(nullable = false, length = 20)
    private String label;

    @Builder.Default
    private short capacity = 4;

    /** Position et taille dans la grille drag & drop */
    @Column(name = "grid_x") @Builder.Default private short gridX = 0;
    @Column(name = "grid_y") @Builder.Default private short gridY = 0;
    @Column(name = "grid_w") @Builder.Default private short gridW = 1;
    @Column(name = "grid_h") @Builder.Default private short gridH = 1;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    @Builder.Default
    private TableShape shape = TableShape.RECT;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    @Builder.Default
    private TableStatus status = TableStatus.FREE;

    /** Token encodé dans le QR Code affiché sur la table physique. */
    @Column(name = "qr_token", unique = true, length = 100)
    private String qrToken;

    /** Début de la session en cours (mis à jour quand la table passe en OCCUPIED). */
    @Column(name = "session_started_at")
    private Instant sessionStartedAt;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public enum TableShape  { RECT, ROUND, BAR }
    public enum TableStatus { FREE, OCCUPIED, RESERVED, DIRTY }
}

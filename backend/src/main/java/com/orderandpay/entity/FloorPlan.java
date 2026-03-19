package com.orderandpay.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "floor_plans")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FloorPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "grid_cols") @Builder.Default private short gridCols = 12;
    @Column(name = "grid_rows") @Builder.Default private short gridRows = 8;

    @Column(name = "background_url", length = 500)
    private String backgroundUrl;

    @Column(name = "is_active") @Builder.Default private boolean active = true;

    @Column(name = "sort_order") @Builder.Default private short sortOrder = 0;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @JsonIgnore
    @OneToMany(mappedBy = "floorPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RestaurantTable> tables = new ArrayList<>();
}

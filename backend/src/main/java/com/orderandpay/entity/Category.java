package com.orderandpay.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "categories")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "sort_order")  @Builder.Default private short sortOrder   = 0;
    @Column(name = "is_visible")  @Builder.Default private boolean visible     = true;

    /** Destination des lignes de commande pour cette catégorie : KITCHEN (défaut) ou BAR. */
    @Column(nullable = false, length = 20) @Builder.Default private String destination = "KITCHEN";

    @Column(name = "created_at", updatable = false) @Builder.Default private Instant createdAt = Instant.now();

    @JsonIgnore
    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY)
    @Builder.Default
    private List<Product> products = new ArrayList<>();
}

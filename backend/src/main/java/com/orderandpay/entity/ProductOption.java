package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "product_options")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "is_required")  @Builder.Default private boolean required   = false;
    @Column(name = "max_choices")  @Builder.Default private short   maxChoices = 1;

    @OneToMany(mappedBy = "option", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductOptionValue> values = new ArrayList<>();
}

@Entity
@Table(name = "product_option_values")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
class ProductOptionValue {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "option_id", nullable = false)
    private ProductOption option;

    @Column(nullable = false, length = 80)
    private String label;

    @Column(name = "price_delta_ht", nullable = false, precision = 10, scale = 4)
    @Builder.Default
    private BigDecimal priceDeltaHt = BigDecimal.ZERO;
}

package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "product_option_values")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductOptionValue {

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

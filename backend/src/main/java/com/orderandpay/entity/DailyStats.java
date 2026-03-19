package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "daily_stats",
       uniqueConstraints = @UniqueConstraint(columnNames = {"restaurant_id", "stat_date"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DailyStats {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(name = "stat_date", nullable = false)
    private LocalDate statDate;

    @Column(name = "total_orders")    @Builder.Default private int totalOrders  = 0;
    @Column(name = "total_covers")    @Builder.Default private int totalCovers  = 0;
    @Column(name = "revenue_ht",      precision = 14, scale = 4) @Builder.Default private BigDecimal revenueHt     = BigDecimal.ZERO;
    @Column(name = "revenue_ttc",     precision = 14, scale = 4) @Builder.Default private BigDecimal revenueTtc    = BigDecimal.ZERO;
    @Column(name = "cost_materials",  precision = 14, scale = 4) @Builder.Default private BigDecimal costMaterials = BigDecimal.ZERO;
    @Column(name = "gross_margin",    precision = 14, scale = 4) @Builder.Default private BigDecimal grossMargin   = BigDecimal.ZERO;
    @Column(name = "avg_basket_ttc",  precision = 10, scale = 4) @Builder.Default private BigDecimal avgBasketTtc  = BigDecimal.ZERO;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "top_products", columnDefinition = "jsonb")
    private Map<String, Object> topProducts;

    @Column(name = "created_at", updatable = false) @Builder.Default private Instant createdAt = Instant.now();
}

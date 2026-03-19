package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "order_lines")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /**
     * Snapshot JSON du produit au moment de la prise de commande.
     * Protège les stats historiques contre les modifications ultérieures du catalogue.
     * Structure : { "name", "price_ht", "vat_rate", "category" }
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "product_snapshot", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> productSnapshot;

    @Column(nullable = false) @Builder.Default private short quantity = 1;

    @Column(name = "unit_price_ht",   nullable = false, precision = 10, scale = 4) private BigDecimal unitPriceHt;
    @Column(name = "vat_rate",        nullable = false, precision = 5,  scale = 2) private BigDecimal vatRate;
    @Column(name = "line_total_ht",   nullable = false, precision = 12, scale = 4) private BigDecimal lineTotalHt;
    @Column(name = "line_total_ttc",  nullable = false, precision = 12, scale = 4) private BigDecimal lineTotalTtc;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private LineStatus status = LineStatus.PENDING;

    private String notes;

    @Column(name = "created_at", updatable = false) @Builder.Default private Instant createdAt = Instant.now();
    @UpdateTimestamp @Column(name = "updated_at") private Instant updatedAt;

    // ── Factory ───────────────────────────────────────────────────────────────

    public static OrderLine from(Order order, Product product, short qty, String notes) {
        BigDecimal lineHt  = product.getPriceHt().multiply(BigDecimal.valueOf(qty));
        BigDecimal vatMult = BigDecimal.ONE.add(product.getVatRate().divide(new BigDecimal("100")));
        BigDecimal lineTtc = lineHt.multiply(vatMult).setScale(4, java.math.RoundingMode.HALF_UP);

        return OrderLine.builder()
                .order(order)
                .product(product)
                .productSnapshot(Map.of(
                        "name",      product.getName(),
                        "price_ht",  product.getPriceHt().toString(),
                        "vat_rate",  product.getVatRate().toString(),
                        "category",  product.getCategory() != null ? product.getCategory().getName() : ""
                ))
                .quantity(qty)
                .unitPriceHt(product.getPriceHt())
                .vatRate(product.getVatRate())
                .lineTotalHt(lineHt)
                .lineTotalTtc(lineTtc)
                .notes(notes)
                .build();
    }

    public enum LineStatus { PENDING, COOKING, READY, SERVED, CANCELLED }
}

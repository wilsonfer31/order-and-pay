package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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

    /** Snapshot de la destination au moment de la commande : KITCHEN ou BAR. */
    @Column(nullable = false, length = 20) @Builder.Default private String destination = "KITCHEN";

    @OneToMany(mappedBy = "orderLine", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderLineOption> selectedOptions = new ArrayList<>();

    @Column(name = "created_at", updatable = false) @Builder.Default private Instant createdAt = Instant.now();
    @UpdateTimestamp @Column(name = "updated_at") private Instant updatedAt;

    // ── Factory ───────────────────────────────────────────────────────────────

    public static OrderLine from(Order order, Product product, short qty, String notes,
                                 List<OrderLineOption> options, String destination) {
        // Prix unitaire HT = prix de base + somme des surcoûts d'options
        BigDecimal optionsDeltaHt = options.stream()
                .map(OrderLineOption::getPriceDeltaHt)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal unitPriceHt = product.getPriceHt().add(optionsDeltaHt);
        BigDecimal lineHt      = unitPriceHt.multiply(BigDecimal.valueOf(qty));
        BigDecimal vatMult     = BigDecimal.ONE.add(product.getVatRate().divide(new BigDecimal("100")));
        BigDecimal lineTtc     = lineHt.multiply(vatMult).setScale(4, RoundingMode.HALF_UP);

        OrderLine line = OrderLine.builder()
                .order(order)
                .product(product)
                .productSnapshot(Map.of(
                        "name",      product.getName(),
                        "price_ht",  product.getPriceHt().toString(),
                        "vat_rate",  product.getVatRate().toString(),
                        "category",  product.getCategory() != null ? product.getCategory().getName() : ""
                ))
                .quantity(qty)
                .unitPriceHt(unitPriceHt)
                .vatRate(product.getVatRate())
                .lineTotalHt(lineHt)
                .lineTotalTtc(lineTtc)
                .notes(notes)
                .destination(destination != null ? destination : "KITCHEN")
                .build();

        options.forEach(o -> o.setOrderLine(line));
        line.getSelectedOptions().addAll(options);
        return line;
    }

    public static OrderLine from(Order order, Product product, short qty, String notes) {
        return from(order, product, qty, notes, List.of(), "KITCHEN");
    }

    public enum LineStatus { PENDING, COOKING, READY, SERVED, CANCELLED }
}

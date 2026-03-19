package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id")
    private RestaurantTable table;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User waiter;

    @Column(name = "order_number", insertable = false, updatable = false)
    private Integer orderNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private OrderStatus status = OrderStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OrderSource source = OrderSource.WAITER;

    @Column(name = "guest_count")
    private Short guestCount;

    private String notes;

    // ── Montants dénormalisés ─────────────────────────────────────────────────
    @Column(name = "total_ht",      precision = 12, scale = 4) @Builder.Default private BigDecimal totalHt     = BigDecimal.ZERO;
    @Column(name = "total_vat_55",  precision = 12, scale = 4) @Builder.Default private BigDecimal totalVat55  = BigDecimal.ZERO;
    @Column(name = "total_vat_10",  precision = 12, scale = 4) @Builder.Default private BigDecimal totalVat10  = BigDecimal.ZERO;
    @Column(name = "total_vat_20",  precision = 12, scale = 4) @Builder.Default private BigDecimal totalVat20  = BigDecimal.ZERO;
    @Column(name = "total_ttc",     precision = 12, scale = 4) @Builder.Default private BigDecimal totalTtc    = BigDecimal.ZERO;

    @Column(name = "confirmed_at")  private Instant confirmedAt;
    @Column(name = "delivered_at")  private Instant deliveredAt;
    @Column(name = "paid_at")       private Instant paidAt;

    @Column(name = "created_at", updatable = false) @Builder.Default private Instant createdAt = Instant.now();
    @UpdateTimestamp @Column(name = "updated_at")   private Instant updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderLine> lines = new ArrayList<>();

    // ── Recalcul des totaux ───────────────────────────────────────────────────
    public void recalculateTotals() {
        totalHt    = BigDecimal.ZERO;
        totalVat55 = BigDecimal.ZERO;
        totalVat10 = BigDecimal.ZERO;
        totalVat20 = BigDecimal.ZERO;

        for (OrderLine line : lines) {
            if (line.getStatus() == OrderLine.LineStatus.CANCELLED) continue;
            totalHt = totalHt.add(line.getLineTotalHt());

            BigDecimal vat = line.getLineTotalHt()
                                 .multiply(line.getVatRate())
                                 .divide(new BigDecimal("100"), 4, java.math.RoundingMode.HALF_UP);

            switch (line.getVatRate().intValue()) {
                case 5  -> totalVat55 = totalVat55.add(vat);
                case 10 -> totalVat10 = totalVat10.add(vat);
                case 20 -> totalVat20 = totalVat20.add(vat);
            }
        }
        totalTtc = totalHt.add(totalVat55).add(totalVat10).add(totalVat20);
    }

    public enum OrderStatus {
        DRAFT, CONFIRMED, IN_PROGRESS, READY, DELIVERED, PAID, CANCELLED
    }

    public enum OrderSource { WAITER, CLIENT_APP, KIOSK }
}

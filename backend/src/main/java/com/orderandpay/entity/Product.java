package com.orderandpay.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "products")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** Prix Hors Taxes — référence immuable pour recalcul. */
    @Column(name = "price_ht", nullable = false, precision = 10, scale = 4)
    private BigDecimal priceHt;

    /**
     * Taux de TVA : 5.5 (produits alimentaires de base),
     *               10  (restauration sur place),
     *               20  (alcools, non-alimentaire).
     */
    @Column(name = "vat_rate", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal vatRate = new BigDecimal("10.00");

    /** Coût matière pour calcul de marge brute. */
    @Column(name = "cost_price", precision = 10, scale = 4)
    private BigDecimal costPrice;

    @Column(name = "allergens", columnDefinition = "text[]")
    private String[] allergens;

    @Column(name = "is_available") @Builder.Default private boolean available = true;

    /** Marqué pour l'upselling dans l'app mobile. */
    @Column(name = "is_upsell")   @Builder.Default private boolean upsell = false;

    @Column(name = "stock_managed") @Builder.Default private boolean stockManaged = false;

    @Column(name = "stock_qty")
    private Integer stockQty;

    @Column(name = "sort_order") @Builder.Default private short sortOrder = 0;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @JsonIgnore
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductOption> options = new ArrayList<>();

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Prix TTC calculé à la volée. */
    public BigDecimal getPriceTtc() {
        return priceHt.multiply(BigDecimal.ONE.add(vatRate.divide(new BigDecimal("100"))));
    }

    /** Marge brute unitaire en % (peut être null si coût non renseigné). */
    public BigDecimal getMarginPercent() {
        if (costPrice == null || costPrice.compareTo(BigDecimal.ZERO) == 0) return null;
        return priceHt.subtract(costPrice)
                      .divide(priceHt, 4, java.math.RoundingMode.HALF_UP)
                      .multiply(new BigDecimal("100"));
    }

    @JsonProperty("categoryId")
    public UUID getCategoryId() {
        return category != null ? category.getId() : null;
    }
}

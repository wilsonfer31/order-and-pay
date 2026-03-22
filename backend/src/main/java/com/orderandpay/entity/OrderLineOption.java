package com.orderandpay.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_line_options")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderLineOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_line_id", nullable = false)
    private OrderLine orderLine;

    /** UUID de la valeur d'option au moment de la commande (référence historique). */
    @Column(name = "option_value_id")
    private UUID optionValueId;

    /** Snapshot du nom du groupe d'option au moment de la commande (ex: "Viande"). */
    @Column(name = "option_name", length = 100)
    private String optionName;

    /** Snapshot du libellé au moment de la commande. */
    @Column(nullable = false, length = 80)
    private String label;

    /** Surcoût HT de cette option. */
    @Column(name = "price_delta_ht", nullable = false, precision = 10, scale = 4)
    @Builder.Default
    private BigDecimal priceDeltaHt = BigDecimal.ZERO;
}

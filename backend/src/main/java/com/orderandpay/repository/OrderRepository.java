package com.orderandpay.repository;

import com.orderandpay.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    List<Order> findByRestaurantIdAndStatus(UUID restaurantId, Order.OrderStatus status);

    Optional<Order> findByIdAndRestaurantId(UUID id, UUID restaurantId);

    @Query("""
            SELECT o FROM Order o
            LEFT JOIN FETCH o.lines l
            LEFT JOIN FETCH l.product
            WHERE o.restaurant.id = :restaurantId
              AND o.status IN ('PAID', 'DELIVERED')
              AND o.paidAt >= :from
              AND o.paidAt <  :to
           """)
    List<Order> findPaidOrdersByRestaurantAndDateRange(
            @Param("restaurantId") UUID restaurantId,
            @Param("from") Instant from,
            @Param("to")   Instant to);

    @Query("""
            SELECT o FROM Order o
            LEFT JOIN FETCH o.lines l
            LEFT JOIN FETCH l.product p
            WHERE o.id = :id AND o.restaurant.id = :restaurantId
           """)
    Optional<Order> findWithLines(@Param("id") UUID id, @Param("restaurantId") UUID restaurantId);

    @Query("""
            SELECT o FROM Order o
            LEFT JOIN FETCH o.lines l
            LEFT JOIN FETCH l.product p
            LEFT JOIN FETCH o.table t
            WHERE o.id = :id
           """)
    Optional<Order> findWithLinesById(@Param("id") UUID id);

    @Query("""
            SELECT DISTINCT o FROM Order o
            LEFT JOIN FETCH o.lines l
            LEFT JOIN FETCH l.product p
            LEFT JOIN FETCH o.table t
            WHERE o.restaurant.id = :restaurantId
              AND o.status IN :statuses
            ORDER BY o.confirmedAt ASC
           """)
    List<Order> findActiveByRestaurantId(@Param("restaurantId") UUID restaurantId,
                                         @Param("statuses") List<Order.OrderStatus> statuses);

    @Query("""
            SELECT DISTINCT o FROM Order o
            LEFT JOIN FETCH o.lines l
            LEFT JOIN FETCH l.product p
            WHERE o.table.id = :tableId
              AND o.status NOT IN ('DRAFT', 'CANCELLED')
            ORDER BY o.createdAt DESC
           """)
    List<Order> findActiveOrdersByTableId(@Param("tableId") UUID tableId);

    @Query("""
            SELECT DISTINCT o FROM Order o
            LEFT JOIN FETCH o.lines l
            LEFT JOIN FETCH l.product p
            LEFT JOIN FETCH o.table t
            WHERE o.restaurant.id = :restaurantId
              AND o.status IN ('DELIVERED', 'PAID')
              AND o.confirmedAt >= :from
              AND o.confirmedAt <  :to
            ORDER BY o.confirmedAt DESC
           """)
    List<Order> findHistory(
            @Param("restaurantId") UUID restaurantId,
            @Param("from") Instant from,
            @Param("to")   Instant to);
}

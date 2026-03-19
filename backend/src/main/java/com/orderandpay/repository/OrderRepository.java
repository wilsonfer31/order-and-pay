package com.orderandpay.repository;

import com.orderandpay.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
              AND o.status = 'PAID'
              AND o.paidAt >= :from
              AND o.paidAt <  :to
           """)
    List<Order> findPaidOrdersByRestaurantAndDateRange(
            @Param("restaurantId") UUID restaurantId,
            @Param("from") LocalDateTime from,
            @Param("to")   LocalDateTime to);

    @Query("""
            SELECT o FROM Order o
            LEFT JOIN FETCH o.lines l
            LEFT JOIN FETCH l.product p
            WHERE o.id = :id AND o.restaurant.id = :restaurantId
           """)
    Optional<Order> findWithLines(@Param("id") UUID id, @Param("restaurantId") UUID restaurantId);
}

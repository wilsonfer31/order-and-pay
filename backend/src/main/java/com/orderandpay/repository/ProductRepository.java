package com.orderandpay.repository;

import com.orderandpay.entity.Product;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    List<Product> findByRestaurantIdAndAvailableTrueOrderBySortOrder(UUID restaurantId);
    List<Product> findByRestaurantIdOrderBySortOrder(UUID restaurantId);
    Optional<Product> findByIdAndRestaurantId(UUID id, UUID restaurantId);
    List<Product> findByCategory_IdAndRestaurantIdOrderBySortOrder(UUID categoryId, UUID restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id AND p.restaurant.id = :restaurantId")
    Optional<Product> findByIdAndRestaurantIdForUpdate(@Param("id") UUID id, @Param("restaurantId") UUID restaurantId);
}

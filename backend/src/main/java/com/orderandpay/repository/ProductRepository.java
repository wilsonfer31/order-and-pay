package com.orderandpay.repository;

import com.orderandpay.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    List<Product> findByRestaurantIdAndAvailableTrueOrderBySortOrder(UUID restaurantId);
    List<Product> findByRestaurantIdOrderBySortOrder(UUID restaurantId);
    Optional<Product> findByIdAndRestaurantId(UUID id, UUID restaurantId);
    List<Product> findByCategory_IdAndRestaurantIdOrderBySortOrder(UUID categoryId, UUID restaurantId);
}

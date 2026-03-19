package com.orderandpay.repository;

import com.orderandpay.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    List<Category> findByRestaurantIdAndVisibleTrueOrderBySortOrder(UUID restaurantId);
    List<Category> findByRestaurantIdOrderBySortOrder(UUID restaurantId);
}

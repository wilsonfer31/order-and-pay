package com.orderandpay.repository;

import com.orderandpay.entity.FloorPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface FloorPlanRepository extends JpaRepository<FloorPlan, UUID> {
    List<FloorPlan> findByRestaurantIdOrderBySortOrder(UUID restaurantId);
}

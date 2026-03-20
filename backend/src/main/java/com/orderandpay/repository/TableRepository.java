package com.orderandpay.repository;

import com.orderandpay.entity.RestaurantTable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TableRepository extends JpaRepository<RestaurantTable, UUID> {
    List<RestaurantTable>    findByFloorPlanIdAndRestaurantId(UUID floorPlanId, UUID restaurantId);
    Optional<RestaurantTable> findByQrToken(String token);
    Optional<RestaurantTable> findByLabelIgnoreCase(String label);
    Optional<RestaurantTable> findByIdAndRestaurantId(UUID id, UUID restaurantId);
    Optional<RestaurantTable> findByIdAndQrToken(UUID id, String qrToken);
    List<RestaurantTable> findAllByOrderByLabel();
}

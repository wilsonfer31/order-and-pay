package com.orderandpay.repository;

import com.orderandpay.entity.RestaurantTable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
    List<RestaurantTable> findByRestaurantIdOrderByLabel(UUID restaurantId);

    /** Verrou pessimiste — utilisé par finalizeTableOrders() pour sérialiser les doubles-scans. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM RestaurantTable t WHERE t.id = :id")
    Optional<RestaurantTable> findByIdForUpdate(@Param("id") UUID id);
}

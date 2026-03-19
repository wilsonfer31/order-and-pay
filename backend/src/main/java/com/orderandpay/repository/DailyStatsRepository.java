package com.orderandpay.repository;

import com.orderandpay.entity.DailyStats;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DailyStatsRepository extends JpaRepository<DailyStats, UUID> {
    Optional<DailyStats> findByRestaurantIdAndStatDate(UUID restaurantId, LocalDate date);
    List<DailyStats> findByRestaurantIdAndStatDateBetweenOrderByStatDate(
            UUID restaurantId, LocalDate from, LocalDate to);
}

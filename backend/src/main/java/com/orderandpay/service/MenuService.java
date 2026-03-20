package com.orderandpay.service;

import com.orderandpay.dto.MenuResponseDto;
import com.orderandpay.entity.Category;
import com.orderandpay.entity.Product;
import com.orderandpay.entity.RestaurantTable;
import com.orderandpay.repository.CategoryRepository;
import com.orderandpay.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository  productRepository;

    /** Mis en cache 5 min — invalidé si le catalogue change. */
    @Cacheable(value = "menu", key = "#table.id")
    public MenuResponseDto buildMenuResponse(RestaurantTable table) {
        List<Category> categories = categoryRepository
                .findByRestaurantIdAndVisibleTrueOrderBySortOrder(table.getRestaurant().getId());

        List<Product> products = productRepository
                .findByRestaurantIdAndAvailableTrueOrderBySortOrder(table.getRestaurant().getId());

        List<MenuResponseDto.CategoryDto> catDtos = categories.stream()
                .map(c -> new MenuResponseDto.CategoryDto(
                        c.getId().toString(), c.getName(), c.getImageUrl(), c.getSortOrder()))
                .toList();

        List<MenuResponseDto.ProductDto> productDtos = products.stream()
                .map(p -> new MenuResponseDto.ProductDto(
                        p.getId().toString(),
                        p.getCategory() != null ? p.getCategory().getId().toString() : null,
                        p.getName(),
                        p.getDescription(),
                        p.getImageUrl(),
                        p.getPriceHt(),
                        p.getPriceTtc(),
                        p.getVatRate(),
                        p.getAllergens(),
                        p.isAvailable(),
                        p.isUpsell()
                ))
                .toList();

        return new MenuResponseDto(
                table.getId().toString(),
                table.getLabel(),
                table.getRestaurant().getName(),
                catDtos,
                productDtos
        );
    }
}

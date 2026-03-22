package com.orderandpay.service;

import com.orderandpay.dto.CreateOrderDto;
import com.orderandpay.entity.*;
import com.orderandpay.repository.OrderRepository;
import com.orderandpay.repository.ProductRepository;
import com.orderandpay.repository.TableRepository;
import com.orderandpay.websocket.OrderEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository    orderRepository;
    @Mock private TableRepository    tableRepository;
    @Mock private ProductRepository  productRepository;
    @Mock private OrderEventPublisher eventPublisher;

    @InjectMocks
    private OrderService orderService;

    private UUID restaurantId;
    private UUID tableId;
    private UUID productId;
    private Restaurant restaurant;
    private RestaurantTable table;
    private Product product;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        tableId      = UUID.randomUUID();
        productId    = UUID.randomUUID();

        restaurant = new Restaurant();
        restaurant.setId(restaurantId);
        restaurant.setName("Demo");
        restaurant.setSlug("demo");

        table = new RestaurantTable();
        table.setId(tableId);
        table.setRestaurant(restaurant);
        table.setLabel("T1");
        table.setStatus(RestaurantTable.TableStatus.FREE);

        product = new Product();
        product.setId(productId);
        product.setRestaurant(restaurant);
        product.setName("Burger");
        product.setPriceHt(new BigDecimal("10.00"));
        product.setVatRate(new BigDecimal("10.00"));
        product.setAvailable(true);
        product.setStockManaged(false);
    }

    // ── createOrder ───────────────────────────────────────────────────────────

    @Test
    void createOrder_happyPath_setsTableOccupiedAndPublishesEvent() {
        CreateOrderDto dto = buildOrderDto(productId, (short) 2);
        when(tableRepository.findByIdAndRestaurantId(tableId, restaurantId)).thenReturn(Optional.of(table));
        when(productRepository.findByIdAndRestaurantIdForUpdate(productId, restaurantId)).thenReturn(Optional.of(product));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        orderService.createOrder(restaurantId, dto);

        assertThat(table.getStatus()).isEqualTo(RestaurantTable.TableStatus.OCCUPIED);
        verify(tableRepository).save(table);
        verify(eventPublisher).notifyKitchen(eq(restaurantId), any());
        verify(eventPublisher).notifyDashboard(eq(restaurantId), any());
    }

    @Test
    void createOrder_stockManaged_decrementsStock() {
        product.setStockManaged(true);
        product.setStockQty(10);

        CreateOrderDto dto = buildOrderDto(productId, (short) 3);
        when(tableRepository.findByIdAndRestaurantId(tableId, restaurantId)).thenReturn(Optional.of(table));
        when(productRepository.findByIdAndRestaurantIdForUpdate(productId, restaurantId)).thenReturn(Optional.of(product));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        orderService.createOrder(restaurantId, dto);

        assertThat(product.getStockQty()).isEqualTo(7);
        verify(productRepository).save(product);
    }

    @Test
    void createOrder_stockManaged_throwsWhenInsufficientStock() {
        product.setStockManaged(true);
        product.setStockQty(2);

        CreateOrderDto dto = buildOrderDto(productId, (short) 5);
        when(tableRepository.findByIdAndRestaurantId(tableId, restaurantId)).thenReturn(Optional.of(table));
        when(productRepository.findByIdAndRestaurantIdForUpdate(productId, restaurantId)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> orderService.createOrder(restaurantId, dto))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Stock insuffisant");
    }

    @Test
    void createOrder_throwsWhenProductUnavailable() {
        product.setAvailable(false);

        CreateOrderDto dto = buildOrderDto(productId, (short) 1);
        when(tableRepository.findByIdAndRestaurantId(tableId, restaurantId)).thenReturn(Optional.of(table));
        when(productRepository.findByIdAndRestaurantIdForUpdate(productId, restaurantId)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> orderService.createOrder(restaurantId, dto))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("non disponible");
    }

    @Test
    void createOrder_throwsWhenTableNotFound() {
        CreateOrderDto dto = buildOrderDto(productId, (short) 1);
        when(tableRepository.findByIdAndRestaurantId(tableId, restaurantId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.createOrder(restaurantId, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Table introuvable");
    }

    // ── cancelOrder ───────────────────────────────────────────────────────────

    @Test
    void cancelOrder_setsStatusCancelledAndPublishesEvent() {
        Order order = buildConfirmedOrder(false, 0);

        when(orderRepository.findWithLines(order.getId(), restaurantId)).thenReturn(Optional.of(order));
        when(orderRepository.findActiveOrdersByTableId(tableId)).thenReturn(List.of(order));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        orderService.cancelOrder(restaurantId, order.getId());

        assertThat(order.getStatus()).isEqualTo(Order.OrderStatus.CANCELLED);
        verify(eventPublisher).notifyKitchen(eq(restaurantId), any());
        verify(eventPublisher).notifyClient(eq(order.getId()), any());
    }

    @Test
    void cancelOrder_restoresStock_whenProductIsStockManaged() {
        product.setStockManaged(true);
        product.setStockQty(5);
        Order order = buildConfirmedOrder(true, 5);

        when(orderRepository.findWithLines(order.getId(), restaurantId)).thenReturn(Optional.of(order));
        when(orderRepository.findActiveOrdersByTableId(tableId)).thenReturn(List.of(order));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        orderService.cancelOrder(restaurantId, order.getId());

        // stock 5 + quantity 3 from line
        assertThat(product.getStockQty()).isEqualTo(8);
        verify(productRepository).save(product);
    }

    @Test
    void cancelOrder_throwsWhenOrderAlreadyDelivered() {
        Order order = buildOrderWithStatus(Order.OrderStatus.DELIVERED);
        when(orderRepository.findWithLines(order.getId(), restaurantId)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.cancelOrder(restaurantId, order.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Impossible d'annuler");
    }

    @Test
    void cancelOrder_throwsWhenOrderAlreadyPaid() {
        Order order = buildOrderWithStatus(Order.OrderStatus.PAID);
        when(orderRepository.findWithLines(order.getId(), restaurantId)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.cancelOrder(restaurantId, order.getId()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void cancelOrder_throwsWhenOrderAlreadyCancelled() {
        Order order = buildOrderWithStatus(Order.OrderStatus.CANCELLED);
        when(orderRepository.findWithLines(order.getId(), restaurantId)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.cancelOrder(restaurantId, order.getId()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void cancelOrder_marksTableDirty_whenAllOrdersComplete() {
        Order order = buildConfirmedOrder(false, 0);

        when(orderRepository.findWithLines(order.getId(), restaurantId)).thenReturn(Optional.of(order));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // After cancel, the only order on the table is the cancelled one → all done
        when(orderRepository.findActiveOrdersByTableId(tableId))
                .thenReturn(List.of(order)); // order will be CANCELLED at this point

        orderService.cancelOrder(restaurantId, order.getId());

        assertThat(table.getStatus()).isEqualTo(RestaurantTable.TableStatus.DIRTY);
        verify(tableRepository).save(table);
        verify(eventPublisher).notifyTables(eq(restaurantId), any());
    }

    @Test
    void cancelOrder_doesNotMarkTableDirty_whenTableAlreadyFree() {
        table.setStatus(RestaurantTable.TableStatus.FREE);
        Order order = buildConfirmedOrder(false, 0);
        order.setTable(table);

        when(orderRepository.findWithLines(order.getId(), restaurantId)).thenReturn(Optional.of(order));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        orderService.cancelOrder(restaurantId, order.getId());

        assertThat(table.getStatus()).isEqualTo(RestaurantTable.TableStatus.FREE);
        verify(tableRepository, never()).save(table);
    }

    @Test
    void cancelOrder_doesNotMarkTableDirty_whenAnotherOrderIsStillActive() {
        Order order = buildConfirmedOrder(false, 0);

        Order otherOrder = new Order();
        otherOrder.setId(UUID.randomUUID());
        otherOrder.setStatus(Order.OrderStatus.IN_PROGRESS);
        otherOrder.setRestaurant(restaurant);

        when(orderRepository.findWithLines(order.getId(), restaurantId)).thenReturn(Optional.of(order));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.findActiveOrdersByTableId(tableId))
                .thenReturn(List.of(order, otherOrder));

        orderService.cancelOrder(restaurantId, order.getId());

        assertThat(table.getStatus()).isNotEqualTo(RestaurantTable.TableStatus.DIRTY);
        verify(tableRepository, never()).save(table);
    }

    // ── markPaid ──────────────────────────────────────────────────────────────

    @Test
    void markPaid_setsStatusPaid() {
        Order order = buildOrderWithStatus(Order.OrderStatus.DELIVERED);
        order.setTable(table);
        when(orderRepository.findByIdAndRestaurantId(order.getId(), restaurantId)).thenReturn(Optional.of(order));
        when(orderRepository.findActiveOrdersByTableId(tableId)).thenReturn(List.of(order));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Order result = orderService.markPaid(restaurantId, order.getId());

        assertThat(result.getStatus()).isEqualTo(Order.OrderStatus.PAID);
        assertThat(result.getPaidAt()).isNotNull();
        verify(eventPublisher).notifyDashboard(eq(restaurantId), any());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CreateOrderDto buildOrderDto(UUID prodId, short qty) {
        return new CreateOrderDto(
                tableId,
                null,
                "CLIENT_APP",
                (short) 2,
                null,
                List.of(new CreateOrderDto.LineDto(prodId.toString(), qty, null))
        );
    }

    private Order buildConfirmedOrder(boolean stockManaged, int currentStock) {
        if (stockManaged) {
            product.setStockManaged(true);
            product.setStockQty(currentStock);
        }

        OrderLine line = new OrderLine();
        line.setId(UUID.randomUUID());
        line.setProduct(product);
        line.setQuantity((short) 3);
        line.setStatus(OrderLine.LineStatus.PENDING);
        line.setUnitPriceHt(product.getPriceHt());
        line.setVatRate(product.getVatRate());
        line.setLineTotalHt(product.getPriceHt().multiply(BigDecimal.valueOf(3)));
        line.setLineTotalTtc(line.getLineTotalHt().multiply(new BigDecimal("1.10")));

        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setRestaurant(restaurant);
        order.setTable(table);
        order.setStatus(Order.OrderStatus.CONFIRMED);
        order.setLines(new ArrayList<>(List.of(line)));
        line.setOrder(order);

        return order;
    }

    private Order buildOrderWithStatus(Order.OrderStatus status) {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setRestaurant(restaurant);
        order.setLines(new ArrayList<>());
        order.setStatus(status);
        return order;
    }
}

package com.orderandpay.controller;

import com.orderandpay.dto.CreateStaffDto;
import com.orderandpay.dto.StaffDto;
import com.orderandpay.dto.UpdateStaffDto;
import com.orderandpay.entity.User;
import com.orderandpay.repository.UserRepository;
import com.orderandpay.security.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/staff")
@RequiredArgsConstructor
public class StaffController {

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    // ── Liste ─────────────────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<StaffDto> list() {
        UUID restaurantId = TenantContext.getCurrentTenant();
        return userRepository.findAllByRestaurantId(restaurantId)
                .stream()
                .sorted(Comparator.comparing(User::getCreatedAt))
                .map(this::toDto)
                .toList();
    }

    // ── Création ──────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<StaffDto> create(@Valid @RequestBody CreateStaffDto dto) {
        UUID restaurantId = TenantContext.getCurrentTenant();

        if (userRepository.findByEmailAndRestaurantId(dto.email(), restaurantId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un utilisateur avec cet email existe déjà.");
        }

        // Récupère la référence du restaurant via un utilisateur existant du tenant
        User existing = userRepository.findAllByRestaurantId(restaurantId).stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR));

        User user = User.builder()
                .restaurant(existing.getRestaurant())
                .email(dto.email().toLowerCase().strip())
                .passwordHash(passwordEncoder.encode(dto.password()))
                .firstName(dto.firstName())
                .lastName(dto.lastName())
                .role(dto.role())
                .active(true)
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(userRepository.save(user)));
    }

    // ── Mise à jour ───────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public StaffDto update(@PathVariable UUID id, @Valid @RequestBody UpdateStaffDto dto) {
        User user = findForTenant(id);
        user.setFirstName(dto.firstName());
        user.setLastName(dto.lastName());
        user.setRole(dto.role());
        if (dto.password() != null && !dto.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(dto.password()));
        }
        return toDto(userRepository.save(user));
    }

    // ── Activer / Désactiver ──────────────────────────────────────────────────

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasRole('OWNER')")
    public StaffDto toggleActive(@PathVariable UUID id) {
        User user = findForTenant(id);
        user.setActive(!user.isActive());
        return toDto(userRepository.save(user));
    }

    // ── Suppression ───────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        User user = findForTenant(id);
        userRepository.delete(user);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User findForTenant(UUID id) {
        UUID restaurantId = TenantContext.getCurrentTenant();
        return userRepository.findById(id)
                .filter(u -> u.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private StaffDto toDto(User u) {
        return new StaffDto(
                u.getId(),
                u.getEmail(),
                u.getFirstName(),
                u.getLastName(),
                u.getRole().name(),
                u.isActive(),
                u.getLastLoginAt(),
                u.getCreatedAt()
        );
    }
}

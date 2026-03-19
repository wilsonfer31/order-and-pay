package com.orderandpay.controller;

import com.orderandpay.entity.User;
import com.orderandpay.repository.UserRepository;
import com.orderandpay.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtService            jwtService;
    private final UserRepository        userRepository;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        authManager.authenticate(
                new UsernamePasswordAuthenticationToken(body.get("email"), body.get("password")));

        User user = userRepository.findByEmail(body.get("email"))
                .orElseThrow();

        // Met à jour lastLogin
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user, user.getRestaurant().getId());

        return ResponseEntity.ok(Map.of(
                "token",        token,
                "restaurantId", user.getRestaurant().getId().toString(),
                "role",         user.getRole().name(),
                "firstName",    user.getFirstName() != null ? user.getFirstName() : "",
                "lastName",     user.getLastName()  != null ? user.getLastName()  : ""
        ));
    }
}

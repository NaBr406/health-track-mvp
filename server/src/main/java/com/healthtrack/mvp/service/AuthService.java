package com.healthtrack.mvp.service;

import com.healthtrack.mvp.domain.User;
import com.healthtrack.mvp.domain.UserProfile;
import com.healthtrack.mvp.dto.AuthDtos.AuthResponse;
import com.healthtrack.mvp.dto.AuthDtos.LoginRequest;
import com.healthtrack.mvp.dto.AuthDtos.RegisterRequest;
import com.healthtrack.mvp.repository.UserProfileRepository;
import com.healthtrack.mvp.repository.UserRepository;
import com.healthtrack.mvp.security.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final CustomUserDetailsService customUserDetailsService;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already exists");
        }

        User user = new User();
        user.setEmail(request.email().trim().toLowerCase());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setNickname(resolveNickname(request.nickname(), request.email()));
        user = userRepository.save(user);

        UserProfile profile = new UserProfile();
        profile.setUser(user);
        profile.setHealthGoal("建立可持续的饮食、运动、护理习惯");
        profile.setCareFocus("睡眠与皮肤基础护理");
        userProfileRepository.save(profile);

        AppUserPrincipal principal = customUserDetailsService.toPrincipal(user);
        String token = jwtService.generateToken(principal);
        return new AuthResponse(token, user.getId(), user.getEmail(), user.getNickname());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email().trim().toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        AppUserPrincipal principal = customUserDetailsService.toPrincipal(user);
        String token = jwtService.generateToken(principal);
        return new AuthResponse(token, user.getId(), user.getEmail(), user.getNickname());
    }

    private String resolveNickname(String nickname, String email) {
        if (StringUtils.hasText(nickname)) {
            return nickname.trim();
        }
        String localPart = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
        return "user_" + localPart;
    }
}


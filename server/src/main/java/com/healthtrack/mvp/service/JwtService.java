package com.healthtrack.mvp.service;

import com.healthtrack.mvp.security.AppUserPrincipal;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 统一负责 JWT 的签发、解析和有效性校验。
 */
@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Long extractUserId(String token) {
        Object userId = extractAllClaims(token).get("uid");
        if (userId == null) {
            return null;
        }
        return Long.parseLong(userId.toString());
    }

    public String generateToken(AppUserPrincipal principal) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("uid", principal.getId());
        return buildToken(claims, principal);
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private String buildToken(Map<String, Object> claims, UserDetails userDetails) {
        Date now = new Date();
        return Jwts.builder()
                .claims(claims)
                .subject(userDetails.getUsername())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + jwtExpirationMs))
                .signWith(getSignInKey())
                .compact();
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(resolveSecret()))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private Key getSignInKey() {
        return Keys.hmacShaKeyFor(resolveSecret());
    }

    private byte[] resolveSecret() {
        if (StringUtils.hasText(jwtSecret) && jwtSecret.matches("^[A-Za-z0-9+/=]+$") && jwtSecret.length() % 4 == 0) {
            try {
                byte[] decoded = Decoders.BASE64.decode(jwtSecret);
                if (decoded.length >= 32) {
                    return decoded;
                }
            } catch (IllegalArgumentException ignored) {
            }
        }
        return jwtSecret.getBytes(StandardCharsets.UTF_8);
    }
}


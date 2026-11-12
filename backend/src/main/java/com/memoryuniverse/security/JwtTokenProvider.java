package com.memoryuniverse.security;

import com.memoryuniverse.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Component
public class JwtTokenProvider {

    private final SecretKey signingKey;
    private final long expirationMinutes;
    private final String issuer;

    public JwtTokenProvider(JwtProperties properties) {
        String secret = properties.secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret 未配置或长度不足 32 字节，请通过环境变量 JWT_SECRET 注入强随机密钥");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMinutes = properties.resolvedExpirationMinutes();
        this.issuer = properties.resolvedIssuer();
    }

    public String generate(UserPrincipal principal) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(expirationMinutes * 60);
        return Jwts.builder()
                .subject(principal.getUsername())
                .issuer(issuer)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .claim("uid", principal.getId())
                .claim("role", principal.getRole())
                .claim("nickname", principal.getNickname())
                .signWith(signingKey)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(issuer)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long expirationSeconds() {
        return expirationMinutes * 60;
    }

    public UserPrincipal toPrincipal(Claims claims) {
        Object uid = claims.get("uid");
        Long userId = uid instanceof Number number ? number.longValue() : null;
        String role = claims.get("role", String.class);
        String nickname = claims.get("nickname", String.class);
        return new UserPrincipal(userId, claims.getSubject(), "", nickname, role, true);
    }
}

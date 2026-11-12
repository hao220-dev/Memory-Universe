package com.memoryuniverse.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, Long expirationMinutes, String issuer) {

    public long resolvedExpirationMinutes() {
        return expirationMinutes == null || expirationMinutes <= 0 ? 720 : expirationMinutes;
    }

    public String resolvedIssuer() {
        return issuer == null || issuer.isBlank() ? "memory-universe" : issuer;
    }
}

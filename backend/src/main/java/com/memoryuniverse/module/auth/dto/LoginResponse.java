package com.memoryuniverse.module.auth.dto;

public record LoginResponse(String token, String tokenType, long expiresIn, UserSummary user) {
}

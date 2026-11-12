package com.memoryuniverse.module.auth.dto;

import com.memoryuniverse.security.UserPrincipal;

public record UserSummary(Long id, String username, String nickname, String role) {

    public static UserSummary from(UserPrincipal principal) {
        return new UserSummary(principal.getId(), principal.getUsername(),
                principal.getNickname(), principal.getRole());
    }
}

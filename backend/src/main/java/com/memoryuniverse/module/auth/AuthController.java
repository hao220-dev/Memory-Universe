package com.memoryuniverse.module.auth;

import com.memoryuniverse.common.api.ApiResponse;
import com.memoryuniverse.common.exception.BusinessException;
import com.memoryuniverse.module.auth.dto.LoginRequest;
import com.memoryuniverse.module.auth.dto.LoginResponse;
import com.memoryuniverse.module.auth.dto.SetupRequest;
import com.memoryuniverse.module.auth.dto.SetupStatus;
import com.memoryuniverse.module.auth.dto.UserSummary;
import com.memoryuniverse.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/setup-status")
    public ApiResponse<SetupStatus> setupStatus() {
        return ApiResponse.ok(authService.setupStatus());
    }

    @PostMapping("/setup")
    public ApiResponse<LoginResponse> setup(@Valid @RequestBody SetupRequest request) {
        return ApiResponse.ok(authService.setup(request));
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ApiResponse<UserSummary> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        return ApiResponse.ok(UserSummary.from(principal));
    }
}

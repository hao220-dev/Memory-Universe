package com.memoryuniverse.module.system;

import com.memoryuniverse.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 桌面模式下的本地优雅关闭入口。
 *
 * 只允许回环地址访问，且必须携带本次启动由 Electron 随机生成、通过环境变量注入的关闭令牌。
 * 令牌不会写入日志；接口不使用 Actuator，也不提供任何公开关闭能力。
 */
@RestController
@RequestMapping("/api/internal")
@Profile("desktop")
public class DesktopShutdownController {

    private static final Logger log = LoggerFactory.getLogger(DesktopShutdownController.class);
    private static final String TOKEN_HEADER = "X-MU-Shutdown-Token";

    private final ApplicationContext context;
    private final String shutdownToken;
    private final AtomicBoolean requested = new AtomicBoolean(false);

    public DesktopShutdownController(ApplicationContext context,
                                     @Value("${MU_SHUTDOWN_TOKEN:}") String shutdownToken) {
        this.context = context;
        this.shutdownToken = shutdownToken;
    }

    @PostMapping("/shutdown")
    public ResponseEntity<ApiResponse<Void>> shutdown(
            @RequestHeader(value = TOKEN_HEADER, required = false) String providedToken,
            HttpServletRequest request) {
        if (!isLoopback(request.getRemoteAddr())) {
            log.warn("拒绝非本机关闭请求，来源={}", request.getRemoteAddr());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(403, "仅允许本机访问"));
        }
        if (!isTokenValid(providedToken)) {
            log.warn("拒绝关闭请求：令牌无效");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(403, "关闭令牌无效"));
        }
        if (!requested.compareAndSet(false, true)) {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.ok());
        }

        log.info("收到合法关闭请求，开始优雅关闭");
        Thread shutdownThread = new Thread(this::shutdownNow, "mu-graceful-shutdown");
        shutdownThread.setDaemon(false);
        shutdownThread.start();
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.ok());
    }

    private void shutdownNow() {
        try {
            // 先让 HTTP 响应完整返回，再关闭上下文，避免 Electron 收不到确认。
            Thread.sleep(150L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        try {
            int code = SpringApplication.exit(context, () -> 0);
            System.exit(code);
        } catch (Throwable e) {
            log.error("优雅关闭失败，改为强制退出", e);
            System.exit(1);
        }
    }

    private boolean isLoopback(String address) {
        return "127.0.0.1".equals(address) || "::1".equals(address) || "0:0:0:0:0:0:0:1".equals(address);
    }

    private boolean isTokenValid(String providedToken) {
        if (shutdownToken == null || shutdownToken.isBlank() || providedToken == null || providedToken.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(
                shutdownToken.getBytes(StandardCharsets.UTF_8),
                providedToken.getBytes(StandardCharsets.UTF_8));
    }
}

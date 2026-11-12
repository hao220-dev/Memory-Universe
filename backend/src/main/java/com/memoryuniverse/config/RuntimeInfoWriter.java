package com.memoryuniverse.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 桌面模式下把实际监听端口写入 Electron 指定的运行信息文件。
 * 端口由 server.port=0 动态分配，避免 Electron 猜测端口。
 */
@Component
public class RuntimeInfoWriter implements ApplicationListener<WebServerInitializedEvent>, DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(RuntimeInfoWriter.class);

    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${MU_RUNTIME_FILE:}")
    private String runtimeFile;

    @Value("${MU_BOOT_ID:}")
    private String bootId;

    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        if (runtimeFile == null || runtimeFile.isBlank()) {
            return;
        }
        try {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("bootId", bootId);
            info.put("port", event.getWebServer().getPort());
            info.put("pid", ProcessHandle.current().pid());
            info.put("startedAt", Instant.now().toString());

            Path target = Path.of(runtimeFile);
            if (target.getParent() != null) {
                Files.createDirectories(target.getParent());
            }
            Path temp = target.resolveSibling(target.getFileName() + ".tmp");
            Files.writeString(temp, mapper.writeValueAsString(info));
            try {
                Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING);
            }
            log.info("运行信息已写入，端口={}", info.get("port"));
        } catch (Exception e) {
            log.warn("写入运行信息失败: {}", e.getMessage());
        }
    }

    /**
     * 优雅关闭时删除本次运行的运行信息文件，避免 Electron 下次启动误读旧端口。
     * 只删除该文件，不触碰数据目录中的数据库、照片与音乐。
     */
    @Override
    public void destroy() {
        if (runtimeFile == null || runtimeFile.isBlank()) {
            return;
        }
        try {
            boolean removed = Files.deleteIfExists(Path.of(runtimeFile));
            if (removed) {
                log.info("运行信息文件已删除");
            }
        } catch (Exception e) {
            log.warn("删除运行信息文件失败: {}", e.getMessage());
        }
    }
}

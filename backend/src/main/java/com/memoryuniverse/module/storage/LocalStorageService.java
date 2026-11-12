package com.memoryuniverse.module.storage;

import com.memoryuniverse.common.exception.BusinessException;
import com.memoryuniverse.config.StorageProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;

@Service
@ConditionalOnProperty(prefix = "app.storage", name = "type", havingValue = "local")
public class LocalStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private final Path root;
    private final String publicBaseUrl;

    public LocalStorageService(StorageProperties properties) {
        this.root = Paths.get(properties.localRoot()).toAbsolutePath().normalize();
        this.publicBaseUrl = properties.localPublicBaseUrl();
    }

    @Override
    public StoredObject store(byte[] bytes, String objectName, String contentType) {
        try {
            Path target = root.resolve(objectName).normalize();
            if (!target.startsWith(root)) {
                throw BusinessException.badRequest("非法的对象路径");
            }
            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.write(target, bytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            return new StoredObject(objectName, publicBaseUrl + "/" + objectName);
        } catch (IOException ex) {
            log.error("Local storage write failed: {}", objectName, ex);
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "文件写入失败");
        }
    }

    @Override
    public void delete(String objectName) {
        try {
            Path target = root.resolve(objectName).normalize();
            if (target.startsWith(root)) {
                Files.deleteIfExists(target);
            }
        } catch (IOException ex) {
            log.warn("Local storage delete failed: {}", objectName, ex);
        }
    }
}

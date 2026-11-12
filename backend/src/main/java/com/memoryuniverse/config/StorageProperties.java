package com.memoryuniverse.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(String type, Local local) {

    public String resolvedType() {
        return type == null || type.isBlank() ? "minio" : type;
    }

    public String localRoot() {
        return local == null || local.root() == null ? "./data/uploads" : local.root();
    }

    public String localPublicBaseUrl() {
        if (local == null || local.publicBaseUrl() == null || local.publicBaseUrl().isBlank()) {
            return "/media";
        }
        return local.publicBaseUrl().endsWith("/")
                ? local.publicBaseUrl().substring(0, local.publicBaseUrl().length() - 1)
                : local.publicBaseUrl();
    }

    public record Local(String root, String publicBaseUrl) {
    }
}

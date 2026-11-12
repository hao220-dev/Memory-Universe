package com.memoryuniverse.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.bootstrap.admin")
public record AdminBootstrapProperties(String username, String password, String nickname, Boolean allowSetup) {

    public String resolvedUsername() {
        return username == null || username.isBlank() ? "admin" : username;
    }

    public String resolvedNickname() {
        return nickname == null || nickname.isBlank() ? "馆长" : nickname;
    }

    /**
     * 是否允许在数据库没有任何管理员时，通过首次设置接口创建管理员。
     * 桌面端与开发环境开启；生产服务端默认关闭，必须通过环境变量注入初始密码。
     */
    public boolean setupAllowed() {
        return Boolean.TRUE.equals(allowSetup);
    }
}

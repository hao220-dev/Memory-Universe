package com.memoryuniverse.module.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memoryuniverse.config.AdminBootstrapProperties;
import com.memoryuniverse.module.user.entity.SysUser;
import com.memoryuniverse.module.user.mapper.SysUserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final SysUserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final AdminBootstrapProperties properties;

    public AdminBootstrap(SysUserMapper userMapper, PasswordEncoder passwordEncoder, AdminBootstrapProperties properties) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        String username = properties.resolvedUsername();
        Long existing = userMapper.selectCount(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, username));
        if (existing != null && existing > 0) {
            return;
        }

        String password = properties.password();
        if (password == null || password.isBlank()) {
            if (properties.setupAllowed()) {
                log.info("尚未创建管理员，等待用户在馆长登录页完成首次设置");
                return;
            }
            throw new IllegalStateException("管理员初始密码未配置，请设置环境变量 ADMIN_PASSWORD");
        }

        SysUser user = new SysUser();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setNickname(properties.resolvedNickname());
        user.setRole("ADMIN");
        user.setEnabled(true);
        userMapper.insert(user);

        log.warn("已创建初始管理员「{}」，请妥善保管密码", username);
    }
}

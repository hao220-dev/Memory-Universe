package com.memoryuniverse.module.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memoryuniverse.common.exception.BusinessException;
import com.memoryuniverse.config.AdminBootstrapProperties;
import com.memoryuniverse.module.auth.dto.LoginRequest;
import com.memoryuniverse.module.auth.dto.LoginResponse;
import com.memoryuniverse.module.auth.dto.SetupRequest;
import com.memoryuniverse.module.auth.dto.SetupStatus;
import com.memoryuniverse.module.auth.dto.UserSummary;
import com.memoryuniverse.module.user.entity.SysUser;
import com.memoryuniverse.module.user.mapper.SysUserMapper;
import com.memoryuniverse.security.JwtTokenProvider;
import com.memoryuniverse.security.UserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final SysUserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final AdminBootstrapProperties bootstrapProperties;

    public AuthService(AuthenticationManager authenticationManager,
                       JwtTokenProvider tokenProvider,
                       SysUserMapper userMapper,
                       PasswordEncoder passwordEncoder,
                       AdminBootstrapProperties bootstrapProperties) {
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.bootstrapProperties = bootstrapProperties;
    }

    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        String token = tokenProvider.generate(principal);
        return new LoginResponse(token, "Bearer", tokenProvider.expirationSeconds(), UserSummary.from(principal));
    }

    /**
     * 首次启动状态：仅在数据库没有任何管理员且当前环境允许设置时，前端展示首次设置表单。
     */
    public SetupStatus setupStatus() {
        return new SetupStatus(adminExists(), bootstrapProperties.setupAllowed());
    }

    /**
     * 首次设置管理员密码。仅在没有任何管理员时可用，成功后直接返回登录令牌。
     */
    public LoginResponse setup(SetupRequest request) {
        if (!bootstrapProperties.setupAllowed()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "当前环境不允许通过界面初始化管理员");
        }
        if (adminExists()) {
            throw BusinessException.conflict("管理员已初始化，请直接登录");
        }

        String username = bootstrapProperties.resolvedUsername();
        Long sameName = userMapper.selectCount(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, username));
        if (sameName != null && sameName > 0) {
            throw BusinessException.conflict("账号已存在，请直接登录");
        }

        SysUser user = new SysUser();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setNickname(bootstrapProperties.resolvedNickname());
        user.setRole("ADMIN");
        user.setEnabled(true);
        try {
            userMapper.insert(user);
        } catch (DataIntegrityViolationException error) {
            throw BusinessException.conflict("管理员已初始化，请直接登录");
        }

        log.info("已通过首次设置创建管理员「{}」", username);
        return login(new LoginRequest(username, request.password()));
    }

    private boolean adminExists() {
        Long count = userMapper.selectCount(new LambdaQueryWrapper<SysUser>().eq(SysUser::getRole, "ADMIN"));
        return count != null && count > 0;
    }
}

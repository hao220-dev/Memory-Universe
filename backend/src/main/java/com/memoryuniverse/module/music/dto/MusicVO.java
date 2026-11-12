package com.memoryuniverse.module.music.dto;

import java.time.LocalDateTime;

public record MusicVO(
        Long id,
        String title,
        String artist,
        String url,
        String coverUrl,
        Integer duration,
        Integer sortOrder,
        Boolean enabled,
        LocalDateTime createdAt
) {
}

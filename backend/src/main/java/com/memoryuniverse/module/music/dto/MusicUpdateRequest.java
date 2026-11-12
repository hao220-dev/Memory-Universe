package com.memoryuniverse.module.music.dto;

public record MusicUpdateRequest(
        String title,
        String artist,
        Integer sortOrder,
        Boolean enabled
) {
}

package com.memoryuniverse.module.photo.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record PhotoVO(
        Long id,
        String title,
        String description,
        Long categoryId,
        String categoryName,
        String originalUrl,
        String thumbnailUrl,
        LocalDate takenAt,
        String location,
        Integer sortOrder,
        Boolean visible,
        Long fileSize,
        LocalDateTime createdAt
) {
}

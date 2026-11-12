package com.memoryuniverse.module.photo.dto;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record PhotoUpdateRequest(
        @Size(max = 120, message = "标题不能超过 120 个字符") String title,
        @Size(max = 1000, message = "描述不能超过 1000 个字符") String description,
        Long categoryId,
        LocalDate takenAt,
        @Size(max = 120, message = "地点不能超过 120 个字符") String location,
        Integer sortOrder,
        Boolean visible
) {
}

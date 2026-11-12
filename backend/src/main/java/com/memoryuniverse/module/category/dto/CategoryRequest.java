package com.memoryuniverse.module.category.dto;

import jakarta.validation.constraints.Size;

public record CategoryRequest(
        @Size(max = 64, message = "分类名称不能超过 64 个字符") String name,
        @Size(max = 64, message = "slug 不能超过 64 个字符") String slug,
        @Size(max = 255, message = "描述不能超过 255 个字符") String description,
        Integer sortOrder
) {
}

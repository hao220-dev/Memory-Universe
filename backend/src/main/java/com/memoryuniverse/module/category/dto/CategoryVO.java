package com.memoryuniverse.module.category.dto;

public record CategoryVO(Long id, String name, String slug, String description, Integer sortOrder, long photoCount) {
}

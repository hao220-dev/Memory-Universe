package com.memoryuniverse.module.storage;

public record ProcessedImage(
        byte[] original,
        byte[] thumbnail,
        String extension,
        String contentType,
        long size,
        int width,
        int height
) {
}

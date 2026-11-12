package com.memoryuniverse.module.storage;

import com.memoryuniverse.common.exception.BusinessException;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.Set;

@Component
public class ImageProcessor {

    private static final long MAX_FILE_SIZE = 20L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png");

    public ProcessedImage process(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("上传文件为空");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "单张图片不能超过 20MB");
        }

        byte[] original;
        try {
            original = file.getBytes();
        } catch (IOException ex) {
            throw BusinessException.badRequest("读取上传文件失败");
        }

        BufferedImage image;
        try (ByteArrayInputStream input = new ByteArrayInputStream(original)) {
            image = ImageIO.read(input);
        } catch (IOException ex) {
            throw BusinessException.badRequest("无法解析图片内容");
        }
        if (image == null) {
            throw BusinessException.badRequest("不支持的图片格式，请上传 JPG 或 PNG");
        }

        String extension = resolveExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw BusinessException.badRequest("仅支持 JPG / PNG 图片");
        }

        byte[] thumbnail;
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Thumbnails.of(image)
                    .size(720, 720)
                    .keepAspectRatio(true)
                    .outputFormat("jpg")
                    .outputQuality(0.85)
                    .toOutputStream(output);
            thumbnail = output.toByteArray();
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "缩略图生成失败");
        }

        String contentType = "png".equals(extension) ? "image/png" : "image/jpeg";
        return new ProcessedImage(original, thumbnail, extension, contentType,
                original.length, image.getWidth(), image.getHeight());
    }

    private String resolveExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }
}

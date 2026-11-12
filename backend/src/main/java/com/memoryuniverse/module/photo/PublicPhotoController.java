package com.memoryuniverse.module.photo;

import com.memoryuniverse.common.api.ApiResponse;
import com.memoryuniverse.common.api.PageResponse;
import com.memoryuniverse.module.photo.dto.PhotoVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/photos")
public class PublicPhotoController {

    private final PhotoService photoService;

    public PublicPhotoController(PhotoService photoService) {
        this.photoService = photoService;
    }

    @GetMapping
    public ApiResponse<PageResponse<PhotoVO>> list(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "24") long size,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(photoService.listPublic(page, size, categoryId, year, keyword));
    }

    @GetMapping("/random")
    public ApiResponse<PhotoVO> random() {
        return ApiResponse.ok(photoService.random());
    }

    @GetMapping("/{id}")
    public ApiResponse<PhotoVO> detail(@PathVariable Long id) {
        return ApiResponse.ok(photoService.getPublic(id));
    }
}

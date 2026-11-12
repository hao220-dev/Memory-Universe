package com.memoryuniverse.module.photo;

import com.memoryuniverse.common.api.ApiResponse;
import com.memoryuniverse.common.api.PageResponse;
import com.memoryuniverse.module.photo.dto.PhotoUpdateRequest;
import com.memoryuniverse.module.photo.dto.PhotoVO;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/photos")
public class AdminPhotoController {

    private final PhotoService photoService;

    public AdminPhotoController(PhotoService photoService) {
        this.photoService = photoService;
    }

    @GetMapping
    public ApiResponse<PageResponse<PhotoVO>> list(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(photoService.listAdmin(page, size, categoryId, keyword));
    }

    @PostMapping(value = "/batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<PhotoVO>> batchUpload(
            @RequestParam("files") MultipartFile[] files,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate takenAt,
            @RequestParam(required = false) String location) {
        return ApiResponse.ok(photoService.upload(files, categoryId, title, description, takenAt, location));
    }

    @PutMapping("/{id}")
    public ApiResponse<PhotoVO> update(@PathVariable Long id, @Valid @RequestBody PhotoUpdateRequest request) {
        return ApiResponse.ok(photoService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        photoService.delete(id);
        return ApiResponse.ok();
    }
}

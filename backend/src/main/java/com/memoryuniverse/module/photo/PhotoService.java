package com.memoryuniverse.module.photo;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.memoryuniverse.common.api.PageResponse;
import com.memoryuniverse.common.exception.BusinessException;
import com.memoryuniverse.module.category.entity.Category;
import com.memoryuniverse.module.category.mapper.CategoryMapper;
import com.memoryuniverse.module.photo.dto.PhotoUpdateRequest;
import com.memoryuniverse.module.photo.dto.PhotoVO;
import com.memoryuniverse.module.photo.entity.Photo;
import com.memoryuniverse.module.photo.mapper.PhotoMapper;
import com.memoryuniverse.module.storage.ImageProcessor;
import com.memoryuniverse.module.storage.ProcessedImage;
import com.memoryuniverse.module.storage.StorageService;
import com.memoryuniverse.module.storage.StoredObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PhotoService {

    private static final DateTimeFormatter PATH_FORMATTER = DateTimeFormatter.ofPattern("yyyy/MM");

    private final PhotoMapper photoMapper;
    private final CategoryMapper categoryMapper;
    private final StorageService storageService;
    private final ImageProcessor imageProcessor;

    public PhotoService(PhotoMapper photoMapper, CategoryMapper categoryMapper,
                        StorageService storageService, ImageProcessor imageProcessor) {
        this.photoMapper = photoMapper;
        this.categoryMapper = categoryMapper;
        this.storageService = storageService;
        this.imageProcessor = imageProcessor;
    }

    public PageResponse<PhotoVO> listPublic(long page, long size, Long categoryId, Integer year, String keyword) {
        LambdaQueryWrapper<Photo> wrapper = new LambdaQueryWrapper<Photo>()
                .eq(Photo::getVisible, true)
                .eq(categoryId != null, Photo::getCategoryId, categoryId)
                .apply(year != null, "YEAR(taken_at) = {0}", year)
                .and(StringUtils.hasText(keyword), w -> w
                        .like(Photo::getTitle, keyword)
                        .or()
                        .like(Photo::getLocation, keyword))
                .orderByDesc(Photo::getTakenAt)
                .orderByDesc(Photo::getId);
        return page(page, size, wrapper);
    }

    public PageResponse<PhotoVO> listAdmin(long page, long size, Long categoryId, String keyword) {
        LambdaQueryWrapper<Photo> wrapper = new LambdaQueryWrapper<Photo>()
                .eq(categoryId != null, Photo::getCategoryId, categoryId)
                .like(StringUtils.hasText(keyword), Photo::getTitle, keyword)
                .orderByDesc(Photo::getCreatedAt)
                .orderByDesc(Photo::getId);
        return page(page, size, wrapper);
    }

    public PhotoVO getPublic(Long id) {
        Photo photo = require(id);
        if (!Boolean.TRUE.equals(photo.getVisible())) {
            throw BusinessException.notFound("照片不存在");
        }
        return toVo(photo, categoryNames());
    }

    public PhotoVO random() {
        Photo photo = photoMapper.selectOne(new LambdaQueryWrapper<Photo>()
                .eq(Photo::getVisible, true)
                .last("ORDER BY RAND() LIMIT 1"));
        if (photo == null) {
            throw BusinessException.notFound("还没有可回忆的照片");
        }
        return toVo(photo, categoryNames());
    }

    @Transactional(rollbackFor = Exception.class)
    public List<PhotoVO> upload(MultipartFile[] files, Long categoryId, String title, String description,
                                LocalDate takenAt, String location) {
        if (files == null || files.length == 0) {
            throw BusinessException.badRequest("请至少选择一张照片");
        }
        if (categoryId != null && categoryMapper.selectById(categoryId) == null) {
            throw BusinessException.badRequest("分类不存在");
        }

        List<Photo> created = new ArrayList<>();
        for (int index = 0; index < files.length; index++) {
            MultipartFile file = files[index];
            ProcessedImage processed = imageProcessor.process(file);

            String uuid = UUID.randomUUID().toString().replace("-", "");
            String folder = "photos/" + LocalDate.now().format(PATH_FORMATTER);
            String objectName = folder + "/" + uuid + "." + processed.extension();
            String thumbnailObjectName = folder + "/" + uuid + "_thumb.jpg";

            StoredObject original = storageService.store(processed.original(), objectName, processed.contentType());
            StoredObject thumbnail = storageService.store(processed.thumbnail(), thumbnailObjectName, "image/jpeg");

            Photo photo = new Photo();
            photo.setTitle(resolveTitle(title, file.getOriginalFilename(), index, files.length));
            photo.setDescription(trimToNull(description));
            photo.setCategoryId(categoryId);
            photo.setOriginalUrl(original.url());
            photo.setThumbnailUrl(thumbnail.url());
            photo.setObjectName(original.objectName());
            photo.setThumbnailObjectName(thumbnail.objectName());
            photo.setFileSize(processed.size());
            photo.setTakenAt(takenAt);
            photo.setLocation(trimToNull(location));
            photo.setSortOrder(0);
            photo.setVisible(true);
            photoMapper.insert(photo);
            created.add(photo);
        }

        Map<Long, String> names = categoryNames();
        return created.stream().map(photo -> toVo(photo, names)).toList();
    }

    @Transactional
    public PhotoVO update(Long id, PhotoUpdateRequest request) {
        Photo photo = require(id);

        if (request.title() != null) {
            String title = trimToNull(request.title());
            if (title == null) {
                throw BusinessException.badRequest("照片标题不能为空");
            }
            photo.setTitle(title);
        }
        if (request.description() != null) {
            photo.setDescription(trimToNull(request.description()));
        }
        if (request.categoryId() != null) {
            if (categoryMapper.selectById(request.categoryId()) == null) {
                throw BusinessException.badRequest("分类不存在");
            }
            photo.setCategoryId(request.categoryId());
        }
        if (request.takenAt() != null) {
            photo.setTakenAt(request.takenAt());
        }
        if (request.location() != null) {
            photo.setLocation(trimToNull(request.location()));
        }
        if (request.sortOrder() != null) {
            photo.setSortOrder(request.sortOrder());
        }
        if (request.visible() != null) {
            photo.setVisible(request.visible());
        }

        photoMapper.updateById(photo);
        return toVo(photo, categoryNames());
    }

    @Transactional
    public void delete(Long id) {
        Photo photo = require(id);
        photoMapper.deleteById(id);
        storageService.delete(photo.getObjectName());
        storageService.delete(photo.getThumbnailObjectName());
    }

    private PageResponse<PhotoVO> page(long page, long size, LambdaQueryWrapper<Photo> wrapper) {
        long safePage = Math.max(1, page);
        long safeSize = Math.min(100, Math.max(1, size));
        IPage<Photo> result = photoMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        Map<Long, String> names = categoryNames();
        List<PhotoVO> records = result.getRecords().stream()
                .map(photo -> toVo(photo, names))
                .toList();
        return PageResponse.of(records, result.getTotal(), safePage, safeSize);
    }

    private Map<Long, String> categoryNames() {
        return categoryMapper.selectList(null).stream()
                .collect(Collectors.toMap(Category::getId, Category::getName, (a, b) -> a));
    }

    private PhotoVO toVo(Photo photo, Map<Long, String> names) {
        String categoryName = photo.getCategoryId() == null ? null : names.get(photo.getCategoryId());
        return new PhotoVO(
                photo.getId(),
                photo.getTitle(),
                photo.getDescription(),
                photo.getCategoryId(),
                categoryName,
                photo.getOriginalUrl(),
                photo.getThumbnailUrl(),
                photo.getTakenAt(),
                photo.getLocation(),
                photo.getSortOrder(),
                photo.getVisible(),
                photo.getFileSize(),
                photo.getCreatedAt()
        );
    }

    private Photo require(Long id) {
        Photo photo = photoMapper.selectById(id);
        if (photo == null) {
            throw BusinessException.notFound("照片不存在");
        }
        return photo;
    }

    private String resolveTitle(String title, String filename, int index, int total) {
        String base = trimToNull(title);
        if (base == null) {
            base = filename == null ? "未命名回忆" : filename.replaceAll("\\.[^.]+$", "").trim();
            if (base.isEmpty()) {
                base = "未命名回忆";
            }
        }
        if (total > 1 && StringUtils.hasText(title)) {
            return base + " · " + (index + 1);
        }
        return base.length() > 120 ? base.substring(0, 120) : base;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

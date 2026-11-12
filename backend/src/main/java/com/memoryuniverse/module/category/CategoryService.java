package com.memoryuniverse.module.category;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memoryuniverse.common.exception.BusinessException;
import com.memoryuniverse.module.category.dto.CategoryRequest;
import com.memoryuniverse.module.category.dto.CategoryVO;
import com.memoryuniverse.module.category.entity.Category;
import com.memoryuniverse.module.category.mapper.CategoryMapper;
import com.memoryuniverse.module.photo.entity.Photo;
import com.memoryuniverse.module.photo.mapper.PhotoMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CategoryService {

    private final CategoryMapper categoryMapper;
    private final PhotoMapper photoMapper;

    public CategoryService(CategoryMapper categoryMapper, PhotoMapper photoMapper) {
        this.categoryMapper = categoryMapper;
        this.photoMapper = photoMapper;
    }

    public List<CategoryVO> listAll() {
        List<Category> categories = categoryMapper.selectList(new LambdaQueryWrapper<Category>()
                .orderByAsc(Category::getSortOrder)
                .orderByAsc(Category::getId));
        return categories.stream().map(this::toVo).toList();
    }

    public Category require(Long id) {
        Category category = categoryMapper.selectById(id);
        if (category == null) {
            throw BusinessException.notFound("分类不存在");
        }
        return category;
    }

    @Transactional
    public CategoryVO create(CategoryRequest request) {
        String name = trimToNull(request.name());
        if (name == null) {
            throw BusinessException.badRequest("分类名称不能为空");
        }
        String slug = resolveSlug(request.slug());
        ensureSlugUnique(slug, null);

        Category category = new Category();
        category.setName(name);
        category.setSlug(slug);
        category.setDescription(trimToNull(request.description()));
        category.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        categoryMapper.insert(category);
        return toVo(category);
    }

    @Transactional
    public CategoryVO update(Long id, CategoryRequest request) {
        Category category = require(id);

        if (request.name() != null) {
            String name = trimToNull(request.name());
            if (name == null) {
                throw BusinessException.badRequest("分类名称不能为空");
            }
            category.setName(name);
        }
        if (request.slug() != null && !request.slug().isBlank()) {
            String slug = resolveSlug(request.slug());
            ensureSlugUnique(slug, id);
            category.setSlug(slug);
        }
        if (request.description() != null) {
            category.setDescription(trimToNull(request.description()));
        }
        if (request.sortOrder() != null) {
            category.setSortOrder(request.sortOrder());
        }

        categoryMapper.updateById(category);
        return toVo(category);
    }

    @Transactional
    public void delete(Long id) {
        require(id);
        Long photoCount = photoMapper.selectCount(new LambdaQueryWrapper<Photo>().eq(Photo::getCategoryId, id));
        if (photoCount != null && photoCount > 0) {
            throw BusinessException.conflict("该分类下仍有照片，请先移动或删除照片");
        }
        categoryMapper.deleteById(id);
    }

    private CategoryVO toVo(Category category) {
        Long count = photoMapper.selectCount(new LambdaQueryWrapper<Photo>()
                .eq(Photo::getCategoryId, category.getId())
                .eq(Photo::getVisible, true));
        return new CategoryVO(category.getId(), category.getName(), category.getSlug(),
                category.getDescription(), category.getSortOrder(), count == null ? 0 : count);
    }

    private void ensureSlugUnique(String slug, Long excludeId) {
        Long count = categoryMapper.selectCount(new LambdaQueryWrapper<Category>()
                .eq(Category::getSlug, slug)
                .ne(excludeId != null, Category::getId, excludeId));
        if (count != null && count > 0) {
            throw BusinessException.conflict("slug 已存在");
        }
    }

    private String resolveSlug(String slug) {
        String value = trimToNull(slug);
        if (value == null) {
            return "cat-" + UUID.randomUUID().toString().substring(0, 8);
        }
        return value.toLowerCase().replaceAll("\\s+", "-");
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

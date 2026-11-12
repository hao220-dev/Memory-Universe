package com.memoryuniverse.module.category;

import com.memoryuniverse.common.api.ApiResponse;
import com.memoryuniverse.module.category.dto.CategoryVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/categories")
public class PublicCategoryController {

    private final CategoryService categoryService;

    public PublicCategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ApiResponse<List<CategoryVO>> list() {
        return ApiResponse.ok(categoryService.listAll());
    }
}

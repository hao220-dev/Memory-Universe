package com.memoryuniverse.module.music;

import com.memoryuniverse.common.api.ApiResponse;
import com.memoryuniverse.module.music.dto.MusicVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/music")
public class PublicMusicController {

    private final MusicService musicService;

    public PublicMusicController(MusicService musicService) {
        this.musicService = musicService;
    }

    @GetMapping
    public ApiResponse<List<MusicVO>> list() {
        return ApiResponse.ok(musicService.listPublic());
    }
}

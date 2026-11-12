package com.memoryuniverse.module.music;

import com.memoryuniverse.common.api.ApiResponse;
import com.memoryuniverse.module.music.dto.MusicUpdateRequest;
import com.memoryuniverse.module.music.dto.MusicVO;
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

import java.util.List;

@RestController
@RequestMapping("/api/admin/music")
public class AdminMusicController {

    private final MusicService musicService;

    public AdminMusicController(MusicService musicService) {
        this.musicService = musicService;
    }

    @GetMapping
    public ApiResponse<List<MusicVO>> list() {
        return ApiResponse.ok(musicService.listAdmin());
    }

    /** 上传音频文件（MP3 / WAV / OGG / M4A / AAC / FLAC / OPUS），也可只填写外部音频地址。 */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<MusicVO> create(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(required = false) String url,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String artist,
            @RequestParam(required = false) Integer sortOrder) {
        return ApiResponse.ok(musicService.create(file, url, title, artist, sortOrder));
    }

    @PutMapping("/{id}")
    public ApiResponse<MusicVO> update(@PathVariable Long id, @RequestBody MusicUpdateRequest request) {
        return ApiResponse.ok(musicService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        musicService.delete(id);
        return ApiResponse.ok();
    }
}

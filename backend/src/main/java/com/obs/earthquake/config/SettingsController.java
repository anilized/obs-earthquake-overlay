package com.obs.earthquake.config;

import com.obs.earthquake.emsc.service.EmscService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final OverlaySettingsService settingsService;
    private final EmscService emscService;

    public SettingsController(OverlaySettingsService settingsService, EmscService emscService) {
        this.settingsService = settingsService;
        this.emscService = emscService;
    }

    @GetMapping
    public OverlaySettings read() {
        return settingsService.current();
    }

    @PostMapping
    public OverlaySettings update(@RequestBody OverlaySettings payload) {
        OverlaySettings updated = settingsService.update(payload);
        emscService.broadcastSettings();
        return updated;
    }

    @PostMapping("/reset")
    public ResponseEntity<OverlaySettings> reset() {
        OverlaySettings updated = settingsService.reset();
        emscService.broadcastSettings();
        return ResponseEntity.ok(updated);
    }
}

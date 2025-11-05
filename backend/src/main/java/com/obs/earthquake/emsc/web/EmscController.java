package com.obs.earthquake.emsc.web;

import com.obs.earthquake.emsc.model.EmscEvent;
import com.obs.earthquake.emsc.service.EmscService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api/events")
public class EmscController {

    private final EmscService service;

    public EmscController(EmscService service) {
        this.service = service;
    }

    @GetMapping("/latest")
    public ResponseEntity<EmscEvent> latest() {
        return service.latestEvent()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of(
                "status", service.lastStatus().name(),
                "hasEvent", service.latestEvent().isPresent()
        );
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return service.stream();
    }

    @PostMapping("/test")
    public ResponseEntity<Void> injectTest(@RequestBody TestEventRequest request) {
        service.publishManualEvent(request.toEvent(), request.respectFilters());
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }
}

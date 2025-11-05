package com.obs.earthquake.emsc.web;

import com.obs.earthquake.emsc.model.EmscEvent;

import java.time.Instant;
import java.util.UUID;

public record TestEventRequest(
        double mag,
        double depth,
        double lat,
        double lon,
        String magtype,
        String province,
        String flynnRegion,
        boolean respectFilters
) {

    EmscEvent toEvent() {
        Instant now = Instant.now();
        String id = "TEST-" + now.toEpochMilli() + "-" + UUID.randomUUID();
        return new EmscEvent(
                id,
                now,
                lat,
                lon,
                mag,
                Double.isFinite(depth) ? depth : null,
                magtype,
                province,
                flynnRegion
        );
    }
}

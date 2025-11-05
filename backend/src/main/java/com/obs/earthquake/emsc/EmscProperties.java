package com.obs.earthquake.emsc;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.nio.file.Path;

@ConfigurationProperties(prefix = "emsc")
public record EmscProperties(
        String wsUrl,
        @DefaultValue("") String bearer,
        @DefaultValue("earthquake_alerts") String topic,
        @DefaultValue("obs-overlay") String clientId,
        Long fixedTimestamp,
        @DefaultValue("0") int sinceWindowSec,
        @DefaultValue("25") int pingIntervalSec,
        Path lastEventCache
) {

    public Path lastEventCache() {
        if (lastEventCache == null) {
            return Path.of("backend-data", "last-event.txt");
        }
        return lastEventCache;
    }
}

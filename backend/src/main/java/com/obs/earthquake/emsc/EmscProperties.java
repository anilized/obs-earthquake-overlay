package com.obs.earthquake.emsc;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "emsc")
public record EmscProperties(
        String wsUrl,
        @DefaultValue("") String bearer,
        @DefaultValue("earthquake_alerts") String topic,
        @DefaultValue("obs-overlay") String clientId,
        Long fixedTimestamp,
        @DefaultValue("0") int sinceWindowSec,
        @DefaultValue("25") int pingIntervalSec
) {}

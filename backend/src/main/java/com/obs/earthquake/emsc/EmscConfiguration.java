package com.obs.earthquake.emsc;

import com.obs.earthquake.emsc.support.LastEventStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EmscConfiguration {

    @Bean
    public LastEventStore lastEventStore() {
        return new LastEventStore();
    }
}

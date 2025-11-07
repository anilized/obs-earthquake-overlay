package com.obs.earthquake.emsc.support;

import jakarta.annotation.PreDestroy;
import org.ehcache.Cache;
import org.ehcache.CacheManager;
import org.ehcache.config.builders.CacheConfigurationBuilder;
import org.ehcache.config.builders.CacheManagerBuilder;
import org.ehcache.config.builders.ResourcePoolsBuilder;

import java.util.Optional;

public class LastEventStore {

    private static final String CACHE_NAME = "lastEventCache";
    private static final String CACHE_KEY = "last-event-id";

    private final CacheManager cacheManager;
    private final Cache<String, String> cache;

    public LastEventStore() {
        this.cacheManager = CacheManagerBuilder.newCacheManagerBuilder()
                .withCache(CACHE_NAME,
                        CacheConfigurationBuilder.newCacheConfigurationBuilder(
                                String.class, String.class, ResourcePoolsBuilder.heap(10)))
                .build(true);
        this.cache = cacheManager.getCache(CACHE_NAME, String.class, String.class);
    }

    public Optional<String> read() {
        return Optional.ofNullable(cache.get(CACHE_KEY));
    }

    public void write(String id) {
        if (id == null || id.isBlank()) {
            return;
        }
        cache.put(CACHE_KEY, id);
    }

    @PreDestroy
    void shutdown() {
        cacheManager.close();
    }
}

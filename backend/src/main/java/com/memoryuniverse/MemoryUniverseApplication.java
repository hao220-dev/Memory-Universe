package com.memoryuniverse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MemoryUniverseApplication {

    public static void main(String[] args) {
        SpringApplication.run(MemoryUniverseApplication.class, args);
    }
}

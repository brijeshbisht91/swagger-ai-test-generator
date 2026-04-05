package core;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.Properties;

public class ConfigReader {

    private static final Properties prop = new Properties();

    static {
        try (FileInputStream fis = new FileInputStream("src/test/resources/config.properties")) {
            prop.load(fis);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load config file", e);
        }
    }

    public static String get(String key) {
        String value = prop.getProperty(key);
        if (value == null || value.isEmpty()) {
            throw new IllegalStateException("Missing or empty config key: " + key);
        }
        return value;
    }
}

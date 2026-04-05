package utils;

import static org.testng.Assert.assertNotNull;

import io.restassured.response.Response;

public class ResponseValidator {

    public static void validateStatusCode(Response response, int expectedStatusCode) {
        response.then().statusCode(expectedStatusCode);
    }

    public static void validateJsonKey(Response response, String key) {
        response.jsonPath().get(key);
        assertNotNull(response.jsonPath().get(key), "key not found" + key);
    }
}

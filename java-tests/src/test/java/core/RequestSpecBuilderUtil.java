package core;

import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;

public final class RequestSpecBuilderUtil {

    private RequestSpecBuilderUtil() {
    }

    /** Reqres API (users, etc.): base URL + API key from config. */
    public static RequestSpecification getRequestSpec() {
        return new RequestSpecBuilder()
                .setBaseUri(ConfigReader.get("base.url"))
                .setContentType(ContentType.JSON)
                .addHeader("x-api-key", ConfigReader.get("api.key"))
                .build();
    }

    /** Swagger Petstore v2: JSON, no API key. */
    public static RequestSpecification getPetstoreRequestSpec() {
        return new RequestSpecBuilder()
                .setBaseUri(ConfigReader.get("petstore.base.url"))
                .setContentType(ContentType.JSON)
                .build();
    }
}

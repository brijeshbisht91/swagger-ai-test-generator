package tests;

import base.BaseTest;
import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class PutpetTest extends BaseTest {

    @Test
    public void testPetUpdate() {
        long id = System.currentTimeMillis() % 1_000_000_000L + 1;
        String create = String.format(
                "{\"id\":%d,\"name\":\"Seed\",\"photoUrls\":[\"http://example.com/pet.jpg\"],\"status\":\"pending\"}",
                id);

        given()
                .contentType(ContentType.JSON)
                .body(create)
                .when()
                .post("/pet")
                .then()
                .statusCode(200);

        String update = String.format(
                "{\"id\":%d,\"name\":\"Fido\",\"photoUrls\":[\"http://example.com/pet.jpg\"],\"status\":\"available\"}",
                id);

        given()
                .contentType(ContentType.JSON)
                .body(update)
                .when()
                .put("/pet")
                .then()
                .statusCode(200)
                .body("name", equalTo("Fido"))
                .body("status", equalTo("available"));
    }
}

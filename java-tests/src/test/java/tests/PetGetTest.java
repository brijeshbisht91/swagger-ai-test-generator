package tests;

import base.BaseTest;
import io.qameta.allure.Description;
import io.qameta.allure.Severity;
import io.qameta.allure.SeverityLevel;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class PetGetTest extends BaseTest {

    @Test
    @Description("Verify testPetGet with valid data")
    @Severity(SeverityLevel.CRITICAL)
    public void testPetGet() {
        long id = System.currentTimeMillis() % 1_000_000_000L + 10_000;
        String create = String.format(
                "{\"id\":%d,\"name\":\"GetMe\",\"photoUrls\":[\"http://example.com/pet.jpg\"],\"status\":\"available\"}",
                id);

        given()
                .header("Content-Type", "application/json")
                .body(create)
                .when()
                .post("/pet")
                .then()
                .statusCode(200);

        given()
                .when()
                .get("/pet/" + id)
                .then()
                .statusCode(200)
                .body("id", equalTo((int) id))
                .body("name", equalTo("GetMe"));
    }
}

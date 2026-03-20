package tests;

import base.BaseTest;
import org.testng.annotations.Test;
import io.qameta.allure.Description;
import io.qameta.allure.Severity;
import io.qameta.allure.SeverityLevel;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class PostpetTest extends BaseTest {

    @Test
    @Description("Verify testCreatePet with valid data")
    @Severity(SeverityLevel.CRITICAL)
    public void testCreatePet() {
        long id = System.currentTimeMillis() % 1_000_000_000L;
        String body = String.format(
                "{\"id\":%d,\"name\":\"MyPet\",\"photoUrls\":[\"http://example.com/pet.jpg\"],\"status\":\"available\"}",
                id);

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/pet")
                .then()
                .statusCode(200)
                .body("id", equalTo((int) id))
                .body("name", equalTo("MyPet"));
    }
}

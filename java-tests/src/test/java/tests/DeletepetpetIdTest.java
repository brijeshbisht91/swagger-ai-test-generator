package tests;

import base.BaseTest;
import io.qameta.allure.Description;
import io.qameta.allure.Severity;
import io.qameta.allure.SeverityLevel;
import io.restassured.response.Response;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class DeletepetpetIdTest extends BaseTest {

    @Test
    @Description("Verify testDeletePet with valid data")
    @Severity(SeverityLevel.CRITICAL)
    public void testDeletePet() {
        long id = (System.currentTimeMillis() % 1_000_000_000L) + 2;
        String body = String.format(
                "{\"id\":%d,\"name\":\"ToDelete\",\"photoUrls\":[],\"status\":\"available\"}",
                id);

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/pet")
                .then()
                .statusCode(200);

        Response response = given().when().delete("/pet/" + id);

        response.then()
                .statusCode(200)
                .body("code", equalTo(200))
                .body("message", equalTo(Long.toString(id)));
    }
}

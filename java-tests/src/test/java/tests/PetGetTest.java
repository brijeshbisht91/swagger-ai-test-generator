package tests;

import base.BaseTest;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class PetGetTest extends BaseTest {

    @Test
    public void testPetGet() {
        // Public demo store: pet 2 is present and stable for reads.
        given()
                .when()
                .get("/pet/2")
                .then()
                .statusCode(200)
                .body("id", equalTo(2));
    }
}

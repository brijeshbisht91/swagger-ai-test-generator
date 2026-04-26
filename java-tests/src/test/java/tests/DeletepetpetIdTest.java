package tests;

import org.testng.annotations.Test;
import base.BaseTest;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;

public class DeletepetpetIdTest extends BaseTest {

    @Test
    public void testDeletePetById() {
        given()
                .baseUri("https://petstore.swagger.io/v2")
                .basePath("/pet/{petId}")
                .pathParam("petId", 1)
                .header("api_key", "special-key")
                .when()
                .delete()
                .then()
                .statusCode(anyOf(is(200), is(404)));
    }
}

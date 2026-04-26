package tests;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;
import base.BaseTest;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;

public class GetpetpetIdTest extends BaseTest {

    @Test
    public void testGetPetById() {
        given()
                .baseUri("https://petstore.swagger.io/v2")
                .basePath("/pet/{petId}")
                .pathParam("petId", 1)
                .accept(ContentType.JSON)
                .when()
                .get()
                .then()
                .statusCode(anyOf(is(200), is(404)));
    }
}

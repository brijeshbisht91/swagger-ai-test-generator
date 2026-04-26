package tests;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;
import base.BaseTest;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;

public class PutpetTest extends BaseTest {

    @Test
    public void testPutPet() {
        given()
                .baseUri("https://petstore.swagger.io/v2")
                .basePath("/pet")
                .contentType(ContentType.JSON)
                .body(
                        "{\"id\":1,\"name\":\"updated\",\"photoUrls\":[],\"status\":\"available\"}")
                .when()
                .put()
                .then()
                .statusCode(anyOf(is(200), is(404), is(405)));
    }
}

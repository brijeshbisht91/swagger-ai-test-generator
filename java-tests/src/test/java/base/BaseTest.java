package base;

import io.restassured.RestAssured;
import org.testng.annotations.BeforeClass;

public class BaseTest {

    /**
     * Official demo API (Swagger Petstore v2). Pet endpoints are under {@code /pet}
     * (e.g. {@code POST https://petstore.swagger.io/v2/pet}).
     */
    protected static final String PETSTORE_V2_BASE_URI = "https://petstore.swagger.io/v2";

    @BeforeClass
    public void setup() {
        RestAssured.baseURI = PETSTORE_V2_BASE_URI;
    }
}
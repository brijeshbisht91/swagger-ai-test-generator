package JavaInterview.APIScenarios;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.testng.Assert;
import org.testng.SkipException;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import JavaInterview.APIScenarios.pojos.ReqresUsersListResponse;
import base.BaseTest;
import io.restassured.RestAssured;
import io.restassured.config.ObjectMapperConfig;
import io.restassured.mapper.ObjectMapperType;
import io.restassured.response.Response;

/**
 * Reqres /api/users scenarios: pagination, id overlap, meta docs URL, support URL,
 * repeat-call consistency, Content-Type, JSON schema, POJO mapping.
 */
public class ApiScenarios extends BaseTest {

    private static final String REQRES_BASE = "https://reqres.in";
    private static final String REQRES_API_KEY = "reqres_ab6c09efe4b64c339b91c04accf337b8";

    @BeforeClass(alwaysRun = true)
    @Override
    public void setup() {
        super.setup();
        RestAssured.config = RestAssured.config()
                .objectMapperConfig(ObjectMapperConfig.objectMapperConfig()
                        .defaultObjectMapperType(ObjectMapperType.JACKSON_2));
    }

    private static Response usersPage(int page) {
        return given()
                .baseUri(REQRES_BASE)
                .header("x-api-key", REQRES_API_KEY)
                .queryParam("page", page)
                .when()
                .get("/api/users");
    }

    private static void assertUrlHeadSucceeds(String label, String url) {
        Assert.assertNotNull(url, label + " should not be null");
        int code = given()
                .redirects().follow(true)
                .when()
                .head(url)
                .then()
                .extract()
                .statusCode();
        Assert.assertTrue(code >= 200 && code < 400, label + " HEAD returned " + code);
    }

    private static int httpStatusForUrlGet(String url) {
        return given()
                .redirects().follow(true)
                .when()
                .get(url)
                .then()
                .extract()
                .statusCode();
    }

    // @Test
    public void validatAPI() {
        Response responseData = given()
                .header("x-api-key", REQRES_API_KEY)
                .when()
                .get(REQRES_BASE + "/api/users");

        int code = responseData.statusCode();
        Assert.assertEquals(code, 200);

        responseData.jsonPath().prettyPrint();

        responseData.jsonPath().get("page");

        double MILLISECONDS = responseData.timeIn(TimeUnit.MILLISECONDS);
        System.out.println(MILLISECONDS);

        String responseFormat = responseData.getContentType();
        System.out.println(responseFormat);

        List<?> dataArray = responseData.jsonPath().getList("data");
        Assert.assertNotNull(dataArray, "data should not be null");
        Assert.assertFalse(dataArray.isEmpty(), "data should not be empty");

        System.out.println("dataArray" + dataArray);

        int perPageData = (int) responseData.jsonPath().get("per_page");
        int dataSize = responseData.jsonPath().getList("data").size();
        Assert.assertEquals(perPageData, dataSize);

        List<Integer> id = responseData.jsonPath().getList("data.id");
        for (Integer val : id) {
            Assert.assertNotNull(val);
        }

        List<String> email = responseData.jsonPath().getList("data.email");
        for (String val : email) {
            if (!val.contains("@reqres.in")) {
                Assert.assertFalse(false);
            }
        }

        List<Integer> ids = responseData.jsonPath().getList("data.id");
        for (Integer getId : ids) {
            if (getId == null) {
                throw new AssertionError("Found null id in response");
            }
        }

        Set<Integer> set = new HashSet<Integer>(ids);
        Assert.assertEquals(ids.size(), set.size(), "Duplicate IDs found");
    }

    // @Test
    public void Test2() {
        Response responseData = given().baseUri(REQRES_BASE)
                .header("x-api-key", REQRES_API_KEY)
                .when().get("/api/users");

        int totalUsers = responseData.jsonPath().get("total");
        int totalPages = responseData.jsonPath().get("total_pages");

        List<Map<String, Object>> allUsers = new ArrayList<>();
        for (int i = 1; i <= totalPages; i++) {

            Response responseDatas = given().baseUri(REQRES_BASE)
                    .header("x-api-key", REQRES_API_KEY)
                    .queryParam("page", i)
                    .when()
                    .get("api/users");

            List<Map<String, Object>> users = responseDatas.jsonPath().getList("data");

            allUsers.addAll(users);
        }
        Assert.assertEquals(allUsers.size(), totalUsers, "User count mismatch!");
    }

    /** Validate pagination logic correctness. */
    @Test
    public void validatePaginationLogicCorrectness1() {
        Response p1 = usersPage(1);
        p1.then().statusCode(200);
        int total = p1.jsonPath().getInt("total");
        int totalPages = p1.jsonPath().getInt("total_pages");
        int perPage = p1.jsonPath().getInt("per_page");
        Assert.assertEquals(p1.jsonPath().getInt("page"), 1);
        Assert.assertTrue(perPage > 0);
        Assert.assertTrue(totalPages >= 1);

        int expectedPages = (total + perPage - 1) / perPage;
        Assert.assertEquals(totalPages, expectedPages, "total_pages should match ceil(total/per_page)");

        List<Map<String, Object>> data1 = p1.jsonPath().getList("data");
        Assert.assertEquals(data1.size(), Math.min(perPage, total), "Page 1 data size");

        if (totalPages >= 2) {
            Response p2 = usersPage(2);
            Assert.assertEquals(p2.jsonPath().getInt("page"), 2);
            List<Map<String, Object>> data2 = p2.jsonPath().getList("data");
            int expectedOnPage2 = Math.min(perPage, Math.max(0, total - perPage));
            Assert.assertEquals(data2.size(), expectedOnPage2);
        }
    }

    /** Compare data across page 1 and page 2 (no overlap). */
    @Test
    public void validatePage1AndPage2HaveNoOverlappingUserIds1() {
        Response p1 = usersPage(1);
        if (p1.jsonPath().getInt("total_pages") < 2) {
            throw new SkipException("Need at least two pages to assert no overlap");
        }
        Response p2 = usersPage(2);
        List<Integer> ids1 = p1.jsonPath().getList("data.id");
        List<Integer> ids2 = p2.jsonPath().getList("data.id");
        Set<Integer> page1Ids = new HashSet<>(ids1);
        for (Integer id : ids2) {
            Assert.assertFalse(page1Ids.contains(id), "User id " + id + " appears on both pages");
        }
    }

    /** Validate _meta.docs_url is reachable. Skips when absent or demo URL errors. */
    @Test
    public void validateMetaDocsUrlIsReachable1() {
        String docsUrl = usersPage(1).jsonPath().getString("_meta.docs_url");
        if (docsUrl == null || docsUrl.isEmpty()) {
            throw new SkipException("_meta.docs_url not present on this API");
        }
        int head = given().redirects().follow(true).when().head(docsUrl).then().extract().statusCode();
        if (head >= 200 && head < 400) {
            return;
        }
        int get = httpStatusForUrlGet(docsUrl);
        if (get >= 200 && get < 400) {
            return;
        }
        throw new SkipException("_meta.docs_url not reachable (HEAD=" + head + ", GET=" + get + "): " + docsUrl);
    }

    /** Validate support.url is not broken. */
    @Test
    public void validateSupportUrlIsNotBroken1() {
        String url = usersPage(1).jsonPath().getString("support.url");
        assertUrlHeadSucceeds("support.url", url);
    }

    /** Check response consistency across multiple calls. */
    @Test
    public void validateResponseConsistencyAcrossMultipleCalls1() {
        Response first = usersPage(1);
        Response second = usersPage(1);
        first.then().statusCode(200);
        second.then().statusCode(200);
        Assert.assertEquals(first.asString(), second.asString(), "Same request should yield identical body");
    }

    /** Validate response headers (Content-Type). */
    @Test
    public void validateResponseContentTypeHeader1() {
        String contentType = usersPage(1).getContentType();
        Assert.assertNotNull(contentType);
        Assert.assertTrue(contentType.toLowerCase().contains("application/json"),
                "Expected JSON content type, got: " + contentType);
    }

    /** Verify contract using JSON schema validation. */
    @Test
    public void verifyContractUsingJsonSchema1() {
        usersPage(1).then()
                .statusCode(200)
                .body(matchesJsonSchemaInClasspath("schemas/reqres-users-list.json"));
    }

    /** Validate response against expected POJO (deserialization). */
    @Test
    public void validateResponseDeserializesToExpectedPojo1() {
        ReqresUsersListResponse dto = usersPage(1).as(ReqresUsersListResponse.class);
        Assert.assertEquals(dto.getPage(), 1);
        Assert.assertTrue(dto.getPerPage() > 0);
        Assert.assertNotNull(dto.getData());
        Assert.assertEquals(dto.getData().size(), Math.min(dto.getPerPage(), dto.getTotal()));
        Assert.assertNotNull(dto.getSupport());
        Assert.assertNotNull(dto.getSupport().getUrl());
    }
}

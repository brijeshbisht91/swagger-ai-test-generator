package services;

import static io.restassured.RestAssured.given;

import core.RequestSpecBuilderUtil;
import io.restassured.response.Response;
import models.TestDataBuilder;

public final class UserService {

    private UserService() {
    }

    public static Response getUsers(int page) {
        return given()
                .spec(RequestSpecBuilderUtil.getRequestSpec())
                .queryParam("page", page)
                .when()
                .get("/api/users");
    }

    public static Response create(String name, String job) {
        return given()
                .spec(RequestSpecBuilderUtil.getRequestSpec())
                .body(TestDataBuilder.createUser(name, job))
                .when()
                .post("/api/users");
    }
}

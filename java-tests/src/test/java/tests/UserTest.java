package tests;

import java.util.List;

import org.testng.annotations.Test;

import io.restassured.response.Response;
import models.User;
import models.UserResponse;
import services.UserService;
import utils.ResponseValidator;

public class UserTest {

    @Test
    public void verifyUserApi() {
        Response response = UserService.getUsers(1);
        ResponseValidator.validateStatusCode(response, 200);
        UserResponse dto = response.as(UserResponse.class);
        ResponseValidator.validateJsonKey(response, "page");
        List<User> data = dto.getData();
        for (User user : data) {
            System.out.println("First Name -->" + user.getFirstName());
        }
    }

    @Test
    public void createUser() {
        Response response = UserService.create("Brijesh", "QA");
        ResponseValidator.validateStatusCode(response, 201);
    }
}

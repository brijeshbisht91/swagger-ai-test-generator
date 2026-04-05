package tests;

import static org.hamcrest.Matchers.equalTo;

import io.qameta.allure.Description;
import io.qameta.allure.Severity;
import io.qameta.allure.SeverityLevel;
import io.restassured.response.Response;
import models.TestDataBuilder;
import org.testng.annotations.Test;

import services.PetService;
import utils.ResponseValidator;

/**
 * Petstore v2 CRUD: bodies built with {@link models.Pet} via {@link TestDataBuilder}.
 */
public class PetCrudTest {

    @Test
    @Description("Verify GET pet after create with valid data")
    @Severity(SeverityLevel.CRITICAL)
    public void testPetGet() {
        long id = System.currentTimeMillis() % 1_000_000_000L + 10_000;

        Response createRes = PetService.createPet(TestDataBuilder.petForGet(id));
        ResponseValidator.validateStatusCode(createRes, 200);

        Response getRes = PetService.getPet(id);
        ResponseValidator.validateStatusCode(getRes, 200);
        getRes.then()
                .body("id", equalTo((int) id))
                .body("name", equalTo("GetMe"));
    }

    @Test
    @Description("Verify create pet with valid data")
    @Severity(SeverityLevel.CRITICAL)
    public void testAddPet() {
        long id = System.currentTimeMillis() % 1_000_000_000L;

        Response response = PetService.createPet(TestDataBuilder.petMyPet(id));
        ResponseValidator.validateStatusCode(response, 200);
        response.then()
                .body("id", equalTo((int) id))
                .body("name", equalTo("MyPet"));
    }

    @Test
    @Description("Verify update pet with valid data")
    @Severity(SeverityLevel.CRITICAL)
    public void testUpdatePet() {
        long id = System.currentTimeMillis() % 1_000_000_000L + 1;

        Response createRes = PetService.createPet(TestDataBuilder.petSeed(id));
        ResponseValidator.validateStatusCode(createRes, 200);

        Response updateRes = PetService.updatePet(TestDataBuilder.petFido(id));
        ResponseValidator.validateStatusCode(updateRes, 200);
        updateRes.then()
                .body("name", equalTo("Fido"))
                .body("status", equalTo("available"));
    }

    @Test
    @Description("Verify delete pet with valid data")
    @Severity(SeverityLevel.CRITICAL)
    public void testDeletePet() {
        long id = (System.currentTimeMillis() % 1_000_000_000L) + 2;

        Response createRes = PetService.createPet(TestDataBuilder.petToDelete(id));
        ResponseValidator.validateStatusCode(createRes, 200);

        Response deleteRes = PetService.deletePet(id);
        ResponseValidator.validateStatusCode(deleteRes, 200);
        deleteRes.then()
                .body("code", equalTo(200))
                .body("message", equalTo(Long.toString(id)));
    }
}

package tests;

import models.TestDataBuilder;
import org.testng.annotations.Test;
import services.PetService;
import utils.ResponseValidator;
import models.Pet;
import io.restassured.response.Response;
import java.io.File;
import java.nio.file.Files;

public class PostpetpetIduploadImageTest {

    @Test
    public void testUploadPetImage() {
        Pet pet = TestDataBuilder.petForGet(1L);
        Response response = PetService.uploadPetImage(pet.getId(), "", new File("test.jpg"));
        ResponseValidator.validateStatusCode(response, 200);
    }
}
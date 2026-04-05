package services;

import static io.restassured.RestAssured.given;

import core.RequestSpecBuilderUtil;
import io.restassured.response.Response;
import java.io.File;
import models.Pet;

public final class PetService {

    private PetService() {
    }

    public static Response createPet(Pet pet) {
        return given()
                .spec(RequestSpecBuilderUtil.getPetstoreRequestSpec())
                .body(pet)
                .when()
                .post("/pet");
    }

    public static Response getPet(long id) {
        return given()
                .spec(RequestSpecBuilderUtil.getPetstoreRequestSpec())
                .when()
                .get("/pet/" + id);
    }

    public static Response updatePet(Pet pet) {
        return given()
                .spec(RequestSpecBuilderUtil.getPetstoreRequestSpec())
                .body(pet)
                .when()
                .put("/pet");
    }

    public static Response deletePet(long id) {
        return given()
                .spec(RequestSpecBuilderUtil.getPetstoreRequestSpec())
                .when()
                .delete("/pet/" + id);
    }
    public static Response uploadPetImage(long petId, String additionalMetadata, File file) {
        return uploadImage(petId, file, additionalMetadata);
    }

    public static Response uploadImage(long petId, File file, String additionalMetadata) {
        return given()
                .spec(RequestSpecBuilderUtil.getPetstoreRequestSpec())
                .multiPart("file", file)
                .formParam("additionalMetadata", additionalMetadata)
                .when()
                .post("/pet/" + petId + "/uploadImage");
    }
}
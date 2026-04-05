package models;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public final class TestDataBuilder {

    private static final String SAMPLE_PHOTO = "http://example.com/pet.jpg";

    private TestDataBuilder() {
    }

    public static CreateUserRequest createUser(String name, String job) {
        return new CreateUserRequest(name, job);
    }

    public static Pet petForGet(long id) {
        return new Pet(id, "GetMe", singlePhoto(), "available");
    }

    public static Pet petMyPet(long id) {
        return new Pet(id, "MyPet", singlePhoto(), "available");
    }

    public static Pet petSeed(long id) {
        return new Pet(id, "Seed", singlePhoto(), "pending");
    }

    public static Pet petFido(long id) {
        return new Pet(id, "Fido", singlePhoto(), "available");
    }

    public static Pet petToDelete(long id) {
        return new Pet(id, "ToDelete", Collections.<String>emptyList(), "available");
    }

    private static List<String> singlePhoto() {
        return Arrays.asList(SAMPLE_PHOTO);
    }
}

package models;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Petstore v2 pet body for POST/PUT /pet (subset of OpenAPI model).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Pet {

    private long id;
    private String name;
    private List<String> photoUrls;
    private String status;
}

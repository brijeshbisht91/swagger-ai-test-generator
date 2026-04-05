package models;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserResponse {

    private int page;
    private int per_page;
    private int total;
    private int total_pages;
    private List<User> data;
}

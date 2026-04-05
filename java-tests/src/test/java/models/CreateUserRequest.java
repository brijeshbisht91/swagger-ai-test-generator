package models;

import lombok.Data;

@Data
public class CreateUserRequest {

    private String name ;
    private String job ;

    CreateUserRequest(String name, String job)
    {
        this.name = name;
        this.job = job;
    }


    
    

}
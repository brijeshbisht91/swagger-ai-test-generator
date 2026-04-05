package JavaInterview.APIScenarios;

import static io.restassured.RestAssured.given;
import static io.restassured.RestAssured.when;
import static org.hamcrest.Matchers.instanceOf;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;

import org.testng.Assert;
import org.testng.annotations.Test;

import base.BaseTest;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import io.restassured.response.ResponseBody;
import io.restassured.response.ValidatableResponse;

public class GetData extends BaseTest {

    @Test(enabled = false)
    public void getData() {

        Response response = given()
                .header("x-api-key", "reqres_ab6c09efe4b64c339b91c04accf337b8")
                .when()
                .get("https://reqres.in/api/users");

        /**
         * From the response:
         * 
         * Validate:page, per_page, total, total_pages are correct, data.size() ==
         * per_page, total_pages = total / per_page
         * 👉 Follow-up: What if last page has fewer records?
         */

        int page = response.jsonPath().getInt("page");
        int totalPages = response.jsonPath().getInt("total_pages");
        int per_Page = response.jsonPath().getInt("per_page");
        int total = response.jsonPath().getInt("total");
        int dataSize = response.jsonPath().getList("data.id").size();

        int expectedtotalPages = total / per_Page;
        int remainder = total % per_Page;
        expectedtotalPages = (remainder > 0)
                ? total / per_Page + 1
                : expectedtotalPages;

        Assert.assertEquals(totalPages, expectedtotalPages);

        int expectedLastPageSize = remainder > 0 ? remainder : per_Page;

        if (page < totalPages)
            Assert.assertEquals(per_Page, dataSize);
        else
            Assert.assertEquals(dataSize, expectedLastPageSize);

    }
   
    @Test(enabled = false)
    public void validateIdUnique() {
      Response response = given()
                .header("x-api-key", "reqres_ab6c09efe4b64c339b91c04accf337b8")
                .when()
                .get("https://reqres.in/api/users");

        List<Integer> listId = response.jsonPath().getList("data.id");
        Set<Integer> uniqueIds = new HashSet<>(listId);
        Assert.assertEquals(uniqueIds.size(), listId.size());

        Set<Integer> set = new HashSet<>();
        Set<Integer> duplicates = new HashSet<>();
        // to find duplicate
        for (Integer id : listId) {
            if (!set.add(id)) {
                set.add(id);

            }
            System.out.println("Duplicate IDs: " + duplicates);

            Assert.assertTrue(!response.jsonPath().getList("data.first_name").isEmpty());
            Assert.assertNotNull(response.jsonPath().getList("data.first_name"));

        }

        List<String> names = response.jsonPath().getList("data.first_name");
        for (String name : names) {
            Assert.assertNotNull(name);
            Assert.assertFalse(name.trim().isEmpty());
}
  
        
       
    }


    @Test(enabled = false)
    public void validate_year_Between2002ToCurrentYear()
    {
        String response = "{\"page\":1,\"per_page\":6,\"total\":12,\"total_pages\":2,\"data\":[{\"id\":1,\"name\":\"cerulean\",\"year\":2000,\"color\":\"#98B2D1\",\"pantone_value\":\"15-4020\"},{\"id\":2,\"name\":\"fuchsiarose\",\"year\":2001,\"color\":\"#C74375\",\"pantone_value\":\"17-2031\"},{\"id\":3,\"name\":\"truered\",\"year\":2002,\"color\":\"#BF1932\",\"pantone_value\":\"19-1664\"},{\"id\":4,\"name\":\"aquasky\",\"year\":2003,\"color\":\"#7BC4C4\",\"pantone_value\":\"14-4811\"},{\"id\":5,\"name\":\"tigerlily\",\"year\":2004,\"color\":\"#E2583E\",\"pantone_value\":\"17-1456\"},{\"id\":6,\"name\":\"blueturquoise\",\"year\":2005,\"color\":\"#53B0AE\",\"pantone_value\":\"15-5217\"}],\"support\":{\"url\":\"https://benhowdle.im/first-cto-playbook?utm_source=reqres&utm_medium=json&utm_campaign=referral\",\"text\":\"BecomeabetterCTO.Aplaybookofpainfulstoriesandpracticaladvicefromatwo-timestartupCTO.\"},\"_meta\":{\"powered_by\":\"ReqRes\",\"docs_url\":\"https://app.reqres.in/documentation\",\"upgrade_url\":\"https://app.reqres.in/upgrade\",\"example_url\":\"https://app.reqres.in/examples/notes-app\",\"variant\":\"v1_b\",\"message\":\"Needmorethanfakedata?ProjectsgiveyourealCRUD+authinminutes.\",\"cta\":{\"label\":\"Getstarted\",\"url\":\"https://app.reqres.in/upgrade\"},\"context\":\"legacy_success\"}}";
               JsonPath res = new JsonPath(response);
        List<Integer> listOfYear = res.getList("data.year");
        List<String> listOfFirst_name = res.getList("data.name");
        LocalDate date = LocalDate.now();
        int i = 0;


       List<Integer> yearAfter2002 = new ArrayList<Integer>();
        
        for (Integer year : listOfYear) {
            if (year > 2002 && year <= date.getYear()) {
                System.out.println(" name after year"+year+"-->" + listOfFirst_name.get(i));
                yearAfter2002.add(year);
            }
            i++;
          }
          int temp = 0;
          for (int k = 0; k < yearAfter2002.size(); i++) {
              for (int j = 0; j < yearAfter2002.size() - 1; j++) {
                  if (yearAfter2002.get(j) > yearAfter2002.get(j+1)) {
                      temp = yearAfter2002.get(j);
                      yearAfter2002.set(j, yearAfter2002.get(j+1));
                      yearAfter2002.set(j+1, temp);

                  }

              }

          }

    }

    @Test
    public void IdTypeValidation()
    {
      
        Response response = given()
                .header("x-api-key", "reqres_ab6c09efe4b64c339b91c04accf337b8")
                .when()
                .get("https://reqres.in/api/users");

            
            //  List<Map<String, Object>> data = response.jsonPath().getList("data");

            //  for(Map<String, Object> item: data)
            //  {

            //    Assert.assertTrue(item.get("id") instanceof Integer);
                   

            //  }

            List<Object> data = response.jsonPath().getList("data");
            for(int i =0;i<data.size();i++)
            {
                Map<String, Object > items =(Map<String, Object >)   data.get(i);

             System.out.println("IDS -->"+items.get("id"));
                

            }



    }

}

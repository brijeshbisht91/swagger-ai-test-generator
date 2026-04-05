package JavaInterview.Collection;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

public class SortMap {

    public static void main(String[] args) {
        

        Map<String, Integer> map=new HashMap<>();
        map.put("A", 3);
        map.put("B", 1);
        map. put("C", 2);


          // Step 1: Convert to list
          List<Map.Entry<String, Integer> > list = new ArrayList<>(map.entrySet());

          // Step 1: Convert to list

          list.sort((a,b) -> a.getValue() - b.getValue());

          // Step 3: Store in LinkedHashMap
          Map<String, Integer> result = new LinkedHashMap<>();


        for (Map.Entry<String, Integer> entry : list) {
            
            result.put(entry.getKey(), entry.getValue());      
            
        }

        System.out.println(result);


    }
    
}

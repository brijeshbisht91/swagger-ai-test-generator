package JavaInterview.Collection;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;

public class IterateMap {

    public static void main(String[] args) {

        Map<String, Integer> map=new HashMap<>();
map.put("A", 1);
map.put("B", 2);
map.put("C", 3);

// for(Map.Entry<String, Integer> itr :map.entrySet())
// {
//     System.out.println(itr.getKey());
// }

// for( String  key:map.keySet())
// {

// }
                Iterator<Entry<String,Integer>> keyval = map.entrySet().iterator();

         


 


    }
}
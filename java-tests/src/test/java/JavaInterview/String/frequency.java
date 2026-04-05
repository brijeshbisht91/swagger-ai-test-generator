package JavaInterview.String;

import java.util.HashMap;
import java.util.Map;

public class frequency {


    public static void main(String[] args) {


        String str = "chandan";

       

        Map<Character, Integer> map = new HashMap<Character, Integer> ();

        for (int i = 0; i < str.length(); i++) {

            if(!map.containsKey(str.charAt(i)))
            {
                map.put(str.charAt(i), 1);
            }
            else
            {
                map.put(str.charAt(i), map.get(str.charAt(i))+1);

            }

            
        }
  

        System.out.println(map);

        for( Character c :map.keySet())
        {
            System.out.println(c +""+ map.get(c));
        }
        
    }
    
}

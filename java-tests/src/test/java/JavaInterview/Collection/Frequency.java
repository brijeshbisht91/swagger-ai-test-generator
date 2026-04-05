package JavaInterview.Collection;

import java.util.HashMap;
import java.util.Map;

public class Frequency {
    public static void main(String[] args) {

        int[] arr = { 1, 2, 2, 3, 1, 4, 2 };

        Map<Integer, Integer> map = new HashMap<Integer, Integer>();

        int count = 1;

        for (int i = 0; i < arr.length; i++) {

            if (!map.containsKey(arr[i])) {
                map.put(arr[i], count);
            } else {
                map.put(arr[i], map.get(arr[i]) + 1);
            }
        }

        System.out.println(map);

        
    }
    
}

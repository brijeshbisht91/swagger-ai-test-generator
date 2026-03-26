package JavaInterview;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

class Array1
{
    public static void main(String[] args) {

        int[] nums = {2, 7, 11, 15};
        int target = 9;

        Map<Integer, Integer> map = new HashMap<Integer, Integer>();
        Map<Integer, Integer> map1 = new HashMap<Integer, Integer>();
       Set<Integer> d = map1.keySet();
        int key = 0;

        for (int i = 0; i < nums.length; i++) {
            map1.put(nums[i], i);

        }

        for (int j = 0; j < nums.length; j++) {
            key = target - nums[j];
            if (map1.containsKey(key)) {
                map.put(key, j);
            }

        }

      System.out.println(map);

        
        
    }
    
}
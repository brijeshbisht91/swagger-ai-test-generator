
package JavaInterview.String;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public class duplicate {

    

    public static void main(String[] args) {
        String str = "testing";

       String result = "";

       //brute force 

        for (int i = 0; i < str.length(); i++) {

            char ch = str.charAt(i);

            if (!result.contains(String.valueOf(ch))) {
                result = result + String.valueOf(ch);
            }

        }

        System.out.println(result);

        //using LinkedHashMap

        // Map<Character, Integer> map = new LinkedHashMap<Character, Integer>();

        // for (int i = 0; i < str.length(); i++) {
        //     if (!map.containsKey(str.charAt(i))) {
        //         map.put(str.charAt(i), 0);

        //     }

        // }

        // for (Character c : map.keySet()) {
        //     result = result + c;
        // }


        //using hashset 
        // String str = "programming";
        // StringBuilder result = new StringBuilder();

        // Set<Character> set = new LinkedHashSet<>();

        // // Add characters to set (removes duplicates automatically)
        // for (char c : str.toCharArray()) {
        //     set.add(c);
        // }

        // // Build result
        // for (char c : set) {
        //     result.append(c);
        // }

        // System.out.println(result.toString());
    }

    }

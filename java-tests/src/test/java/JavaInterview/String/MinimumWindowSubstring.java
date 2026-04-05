package JavaInterview.String;

import java.util.HashMap;
import java.util.Map;

public class MinimumWindowSubstring{


    //very important
    public static void main(String[] args) {

    
        
        String s = "ADOBECODEBANC";
        String t = "ABC";

        Map<Character, Integer> need = new HashMap<>();

        for (char c : t.toCharArray()) {
            need.put(c, need.getOrDefault(c, 0) + 1);
        }

    
        int left = 0;
        int have = 0;
        int needCount = need.size();
        int start = 0;
        int minLen = Integer.MAX_VALUE;
        
        Map<Character, Integer> window = new HashMap<>();
        for (int right = 0; right < s.length(); right++) {

            char ch = s.charAt(right);
            window.put(ch, window.getOrDefault(ch, 0) + 1);

            if (need.containsKey(ch) &&
                window.get(ch).intValue() == need.get(ch).intValue()) {
                have++;
            }

            // shrink window
            while (have == needCount) {

                if (right - left + 1 < minLen) {
                    minLen = right - left + 1;
                    start = left;
                }

                char leftChar = s.charAt(left);
                window.put(leftChar, window.get(leftChar) - 1);

                if (need.containsKey(leftChar) &&
                    window.get(leftChar) < need.get(leftChar)) {
                    have--;
                }

                left++;
            }
        }

        if (minLen == Integer.MAX_VALUE) {
            System.out.println("");
        } else {
            System.out.println(s.substring(start, start + minLen));
        }

        
    }
}

    


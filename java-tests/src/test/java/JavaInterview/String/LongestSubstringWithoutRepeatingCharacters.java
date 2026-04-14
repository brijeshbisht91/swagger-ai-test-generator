package JavaInterview.String;

import java.util.ArrayList;
import java.util.List;

/**
 * Longest substring without repeating characters (all distinct).
 * <p>
 * Technique: brute force — for each start index, extend the substring until a repeat;
 * {@code temp.contains} checks uniqueness.
 * <p>
 * Time: O(n³) in the worst case (roughly n² pairs × O(length) {@code contains} / concat).
 * Space: O(n) for the list and temporary strings.
 */
public class LongestSubstringWithoutRepeatingCharacters {

    public static void main(String[] args) {
        
        String str = "abcabcefgbb";

        List<String> list = new ArrayList<String>();

        for (int i = 0; i < str.length(); i++) {

            String temp = "";

            for (int j = i; j < str.length(); j++) {

                if (!temp.contains(str.substring(j, j + 1))) {
                    temp += str.substring(j, j + 1);

                } else
                    break;

            }

            list.add(temp);

        }

        int max = 0;

        String result = "";
        for (String l : list) {
            if (l.length() > max) {
                max = l.length();
                result = l;
            }

        }

        System.out.println(result);

    }

    
    
}

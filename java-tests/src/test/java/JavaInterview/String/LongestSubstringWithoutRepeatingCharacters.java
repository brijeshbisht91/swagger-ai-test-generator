package JavaInterview.String;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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

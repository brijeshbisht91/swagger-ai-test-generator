package JavaInterview;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class longestSubstring {
    public static void main(String[] args) {
        
       
        String s = "addbbczsddf";

        Set<Character> set = new HashSet<>();

        int left = 0;
        int maxLen = 0;
        String result = "";

        for (int i = 0; i < s.length(); i++) {

            char ch = s.charAt(i);

            while (set.contains(ch)) {
                set.remove(s.charAt(left));
                left++;
            }

            set.add(ch);

            if (i - left + 1 > maxLen) {
                maxLen = i - left + 1;
                result = s.substring(left, i + 1);
            }
        }

        System.out.println("Substring = " + result);
        System.out.println("Length = " + maxLen);
    
        //  for (int i = 0; i < s.length(); i++) {

        //      String temp = "";
        //      for (int j = i; j < s.length(); j++) {

        //          if (!temp.contains(s.substring(j, j + 1))) {
        //              temp = temp + s.substring(j, j + 1);

        //          } else
        //              break;

        //      }

        //      if (temp.length() > newString.length()) {
        //          newString = temp;
        //      }

        //  }

        //  System.out.println("newString-->" + newString);



        


       
    }



 





    
}

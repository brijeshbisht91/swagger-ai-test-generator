package JavaInterview.String;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class subStringOfString {

    public static void main(String[] args) {
        

        String str = "chandan";

        String newStr = "";

        List<String> list = new ArrayList<>();
 
        Set<String> set = new HashSet<String>();

        for (int i = 0; i < str.length(); i++) {

        

            for (int j = i+1; j <=str.length(); j++) {

                set.add(str.substring(i, j));
          
                
            }
            
        }

        System.out.println(set);


    }


    
}

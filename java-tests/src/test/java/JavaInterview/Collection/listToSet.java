package JavaInterview.Collection;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;

public abstract class listToSet {

    public static void main(String[] args) {

        int [] arr = {1,2,3,4};

        List<Integer> list =new ArrayList<>();

        for (int num : arr) {
            list.add(num);
        }

        System.out.println(list);

        HashSet<Integer> set = new HashSet<Integer>(list);

    
        
    


        
    }
    
}

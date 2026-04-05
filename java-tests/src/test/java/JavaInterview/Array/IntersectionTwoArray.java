package JavaInterview.Array;

import java.util.HashSet;
import java.util.Set;

public class IntersectionTwoArray {

    public static void main(String[] args) {

       int[] arr1 = {1, 2, 2, 3, 4};
       int[] arr2 = {2, 2, 4, 6};
        
        //BruteForce
        for (int i = 0; i < arr1.length; i++) {
            for (int j = 0; j < arr2.length; j++) {
        
                if (arr1[i] == arr2[j]) {
                    System.out.print(arr1[i] + " ");
                    break; // avoid duplicate print for same i
                }
            }
        }

        //Better (Using HashSet) 🔥Set<Integer> set1 = new HashSet<>();
        Set<Integer> set1 = new HashSet<>();
        Set<Integer> result = new HashSet<>();

        for (int num : arr1) {
            set1.add(num);
        }

        for (int num : arr2) {
            if (set1.contains(num)) {
                result.add(num);
            }
        }

        System.out.println(result);
    }
    
}

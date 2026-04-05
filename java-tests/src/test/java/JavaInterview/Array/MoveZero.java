package JavaInterview.Array;

import java.util.Arrays;

public class MoveZero {

    public static void main(String[] args) {

        int [] arr  ={1, 0, 2, 0, 0, 3, 4};
        int right =0;

        for (int i = 0; i < arr.length; i++) {
            if(!(arr[i]==0))
            {
                int tmp = arr[i];  //2
                arr[i] = arr[right];//0
                arr[right]= tmp; //2
                right++;
            }
          
            
        }

        System.out.println(Arrays.toString(arr));

        
    }
    
}

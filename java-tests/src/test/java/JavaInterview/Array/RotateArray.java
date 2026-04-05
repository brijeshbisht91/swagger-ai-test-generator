package JavaInterview.Array;

import java.util.Arrays;

public class RotateArray {
    
    public static void main(String[] args) {
      int [] arr = {1, 2, 3, 4, 5};
      int  k =  2;


      //reverse an array 

      for (int i =0 ;i<arr.length/2;i++)
      {

        int tmp = arr[i];
        arr[i] = arr[arr.length-1 -i];
        arr[arr.length-1 -i]= tmp;



      }

      //reverse first k element

      for (int i =0 ;i<k/2;i++)
        {
  
          int tmp = arr[i];
          arr[i] = arr[k-1 -i];
          arr[k-1 -i]= tmp;
  
        }
  
        System.out.println(Arrays.toString(arr) );

    
   // 🔹 Step 3: Reverse remaining elements
    for (int i =0 ;i<(arr.length -k)/2;i++)
    {

      int tmp = arr[k];
      arr[k] = arr[arr.length-1 -i];
      arr[arr.length-1 -i]= tmp;
      k++;

    }

    System.out.println(Arrays.toString(arr) );
}

}

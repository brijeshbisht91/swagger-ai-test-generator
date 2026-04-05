package JavaInterview.Array;

public class SecondLargest {

    public static void main(String[] args) {
        
        int [] arr = {2, 3, 101, 13, 9, 11};

        int max =0 ;
        int secondLargest=arr[0];

        for (int i = 1; i < arr.length; i++) {

            if(arr[i]>max)
            {
                max = arr[i];
            }
            else if (arr[i]>secondLargest)
            {
                secondLargest = arr[i];
            }
            
        }

        System.out.println("max"+max);
        System.out.println("secondLargest"+secondLargest);
    }
    
}

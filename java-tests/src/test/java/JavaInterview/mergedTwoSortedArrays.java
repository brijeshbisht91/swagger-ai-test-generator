package JavaInterview;

import java.util.Arrays;

public class mergedTwoSortedArrays {
    public static void main(String[] args) {

        int [] a = {1, 3, 5};

        int [] b = {2, 4, 6};



        int i = 0, j = 0, k =0;
        
        int [] c = new int [a.length + b.length];


        while(i<a.length && j<b.length)
        {
            if(a[i]<=b[j])
            {
                c[k++] = a[i++];

            }
            else
            {
                c[k++] = b[j++];
            }

        }

             // Copy remaining elements
             while (i < a.length) {
                c[k++] = a[i++];
            }
            while(j<b.length)
            {
                c[k++] = b[j++];
            }

        System.out.println(Arrays.toString(c));

    }
};
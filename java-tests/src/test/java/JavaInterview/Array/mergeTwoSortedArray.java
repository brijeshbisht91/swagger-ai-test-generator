package JavaInterview.Array;

import java.util.Arrays;

public class mergeTwoSortedArray {

public static void main(String[] args) {
    int[] a = { 1, 3, 5 };

    int[] b = { 2, 4, 6 };

    int[] k = new int[a.length + b.length];

    int i = 0, j = 0,c=0;
    while (i < a.length && j < b.length) {

        if (a[i] < b[j]) {
            k[c] = a[i];
            i++;
            c++;
        } else {
            k[c] = b[j];
            j++;
            c++;
        }

            // Copy remaining elements
            while (i < a.length) {
                k[c++] = a[i++];
            }
            while(j<b.length)
            {
                k[c++] = b[j++];
            }
    }
    System.out.println(Arrays.toString(k));

}


    
}

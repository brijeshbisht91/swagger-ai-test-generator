package JavaInterview;

public class rotateArray {
    public static void main(String[] args) {
        //to the right
        int[] nums = {3,4,5,6,3,2,1};

        int k = 3;

        int n = nums.length;

        // 🔹 Step 1: Reverse full array
        // {7,6,5,4,3,2,1};

        int start = 0; 
       int  end = n-1;
        while (start<end)
        {
            int temp = nums[start];
            nums[start]=nums[end];
            nums[end]= temp;
            start ++;
            end --;

        }

       // 🔹 Step 2: Reverse first k elements
    //5 6 7 4 3 2 1
       start = 0;
       end = k - 1;
       while (start < end) {
           int temp = nums[start];
           nums[start] = nums[end];
           nums[end] = temp;
           start++;
           end--;
       }

   // 🔹 Step 3: Reverse remaining elements

    //4,5,6,7,1,2,3
      // 🔹 Step 3: Reverse remaining elements
        start = k;
        end = n - 1;
        while (start < end) {
            int temp = nums[start];
            nums[start] = nums[end];
            nums[end] = temp;
            start++;
            end--;
        }





    }
    
}

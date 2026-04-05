package JavaInterview.Array;

public class MissingNo {

    public static void main(String[] args) {
        
          
      int[] arr = {94,96, 97};
      
      int ActualSum =0;
      int totalSum=0;
      
        
        for(int i =0; i<arr.length;i++)
        {
          ActualSum = ActualSum +arr[i];
          
        }
        
        int count =0;
        
        for(int i =arr[0]; i<=arr[arr.length-1];i++)
        {

          totalSum =totalSum + arr[0]+count;
          count ++;

          
        }
        
        int missingNo = totalSum -ActualSum;
        
        System.out.println("Missing no"+missingNo);
    }
    
}

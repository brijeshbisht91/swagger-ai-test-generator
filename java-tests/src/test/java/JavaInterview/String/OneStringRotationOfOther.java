package JavaInterview.String;

public class OneStringRotationOfOther {

    public static void main(String[] args) {

        String str1 = "abcde";
        String str2 = "abced";
 
        String newStr = str1 +str1;

    if(newStr.contains(str2))
    {
        System.out.println(true);
    }
    else
        System.out.println(false);
    
        
    }
    
}

package JavaInterview.Collection;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class commonElementInList {

    public static void main(String[] args) {
        List<Integer> list1 = Arrays.asList(1, 2, 3, 4, 5);
      List<Integer> list2 = Arrays.asList(3, 4, 5, 6, 7);

List<Integer> data=new ArrayList<Integer>();
for(Integer common :list1)
{

    if(list2.contains(common))
    {
        data .add(common);
        
    }

}

System.out.println(data);


    }
    
}

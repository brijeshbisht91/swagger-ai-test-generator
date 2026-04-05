package JavaInterview.Collection;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class RemoveDuplicate {

    public static void main(String[] args) {

    

      List<Integer> l =  new ArrayList<Integer>();
      l.add(1);
      l.add(2);
      l.add(3);
      l.add(2);
      l.add(1);

// List<Integer> result = new ArrayList<>();
//     for(Integer x:l)
//     {
//         if(!result.contains(x))
//         {
//             result.add(x);
//         }
//     }

//     System.out.println("data"+result);

            //Using Set (Best & Simple)
    Set<Integer> set = new LinkedHashSet<>(l);

    System.out.println(set);
     }
    

}

package JavaInterview;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class anagram {

    public static void main(String[] args) {
        String[] str = { "eat", "tea", "tan", "ate", "nat", "bat" };

        Map<String, List<String>> map = new HashMap<>();

        for (int i = 0; i < str.length; i++) {

            char[] stringToChar = str[i].toCharArray();
            Arrays.sort(stringToChar);

            String key = new String(stringToChar);

            if (!map.containsKey(key)) {
                map.put(key, new ArrayList<>());
            }
            map.get(key).add(str[i]);

        }
        System.out.println(map.values());

    }

}

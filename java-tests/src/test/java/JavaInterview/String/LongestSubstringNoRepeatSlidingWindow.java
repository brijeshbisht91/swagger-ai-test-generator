package JavaInterview.String;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Longest substring without repeating characters (same problem as {@link LongestSubstringWithoutRepeatingCharacters}).
 * <p>
 * Technique: sliding window — maintain [left, right] with no duplicates; on repeat, move {@code left}
 * to {@code lastIndex[ch] + 1}. Track last index per character in a map.
 * <p>
 * Time: O(n) — each index visited by {@code right} once, {@code left} only moves forward.
 * Space: O(min(n, |Σ|)) — map size bounded by alphabet or string length.
 */
public class LongestSubstringNoRepeatSlidingWindow {

    public static void main(String[] args) {
        String s = "abcabcdbb";
        Set<Character> set = new HashSet<>();

        int left = 0;
        int maxLength = 0;
        int index = 0;
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            while (set.contains(ch)) {
                set.remove(ch);
                left++;
            }
            set.add(ch);

            if (i - left + 1 > maxLength) {
                maxLength = i - left + 1;
                index = left;
            }

        }

        System.out.println("Longest substring length: " + maxLength);
        System.out.println("Longest substring : " + s.substring(index, index + maxLength));
    }
}

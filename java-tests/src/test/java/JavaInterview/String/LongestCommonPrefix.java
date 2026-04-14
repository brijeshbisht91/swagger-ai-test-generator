package JavaInterview.String;

/**
 * Longest common prefix across an array of strings.
 * <p>
 * Technique: vertical scan — compare character i of all strings against the first string’s i-th char;
 * stop at first mismatch or shorter string.
 * <p>
 * Time: O(S) where S is the sum of all characters (stops early at mismatch).
 * Space: O(1) extra besides the returned substring.
 */
public class LongestCommonPrefix {

    public static void main(String[] args) {
        String[] words = { "flower", "flow", "flight" };
        System.out.println(longestCommonPrefix(words)); // fl

        String[] words2 = { "dog", "racecar", "car" };
        System.out.println(longestCommonPrefix(words2)); // ""
    }

    static String longestCommonPrefix(String[] strs) {
        if (strs == null || strs.length == 0) {
            return "";
        }
        String first = strs[0];
        for (int i = 0; i < first.length(); i++) {
            char c = first.charAt(i);
            for (int j = 1; j < strs.length; j++) {
                if (i >= strs[j].length() || strs[j].charAt(i) != c) {
                    return first.substring(0, i);
                }
            }
        }
        return first;
    }
}

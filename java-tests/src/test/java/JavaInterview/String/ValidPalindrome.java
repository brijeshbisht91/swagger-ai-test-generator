package JavaInterview.String;

/**
 * Alphanumeric palindrome (ignores case and non-alphanumeric characters).
 * <p>
 * Technique: normalize (lowercase + strip non-alphanumeric via regex), then two pointers
 * from both ends comparing characters.
 * <p>
 * Time: O(n) for the two-pointer pass; plus O(n) for normalization → O(n) overall.
 * Space: O(n) for the cleaned string (in-place two-pointer without building a full cleaned string would be O(1) extra).
 */
public class ValidPalindrome {

    public static void main(String[] args) {
        String str = "A man, a plan, a canal: Panama";

        str = str.toLowerCase().replaceAll("[^a-z0-9]", "");

        int left = 0;   
        int right = str.length() - 1;

        boolean isPalindrome = true;

        while (left < right) {
            if (str.charAt(left) != str.charAt(right)) {
                isPalindrome = false;
                break;
            }
            left++;
            right--;
        }

        System.out.println(isPalindrome);
    }
}

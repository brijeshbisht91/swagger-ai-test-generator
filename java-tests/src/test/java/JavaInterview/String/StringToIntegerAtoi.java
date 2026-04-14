package JavaInterview.String;

/**
 * Parse signed integer (atoi-style): optional whitespace, optional sign, digit run, clamp to int range.
 * <p>
 * Technique: single linear scan with implicit state (skip spaces → read sign → accumulate digits with overflow check).
 * <p>
 * Time: O(n) — one pass over the string.
 * Space: O(1) extra.
 */
public class StringToIntegerAtoi {

    public static void main(String[] args) {
        System.out.println(myAtoi("   -42")); // -42
        System.out.println(myAtoi("4193 with words")); // 4193
        System.out.println(myAtoi("words and 987")); // 0
    }

    static int myAtoi(String s) {
        if (s == null) {
            return 0;
        }
        int i = 0;
        int n = s.length();
        while (i < n && s.charAt(i) == ' ') {
            i++;
        }
        if (i == n) {
            return 0;
        }

        int sign = 1;
        if (s.charAt(i) == '+' || s.charAt(i) == '-') {
            sign = s.charAt(i) == '-' ? -1 : 1;
            i++;
        }

        long result = 0;
        while (i < n && Character.isDigit(s.charAt(i))) {
            result = result * 10 + (s.charAt(i) - '0');
            if (sign * result > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }
            if (sign * result < Integer.MIN_VALUE) {
                return Integer.MIN_VALUE;
            }
            i++;
        }
        return (int) (sign * result);
    }
}

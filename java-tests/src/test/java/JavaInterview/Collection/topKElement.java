// package JavaInterview.Collection;

// public class topKElement {

//     public static void main(String[] args) {


// int[] nums = {1,1,1,2,2,3};
// int k = 2;

// // Step 1: Frequency map
// Map<Integer, Integer> map = new HashMap<>();
// for (int num : nums) {
//     map.put(num, map.getOrDefault(num, 0) + 1);
// }

// // Step 2: Max Heap (based on frequency)
// PriorityQueue<Integer> pq = new PriorityQueue<>(
//     (a, b) -> map.get(b) - map.get(a)
// );

// // add all keys
// pq.addAll(map.keySet());

// // Step 3: Get top k
// List<Integer> result = new ArrayList<>();
// for (int i = 0; i < k; i++) {
//     result.add(pq.poll());
// }

// System.out.println(result);
//     }
    
// }

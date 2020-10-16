export const MAX_DRIFT = 60000;
export const COUNTER_LENGTH = 4;
export const COUNTER_BASE = 16;
export const MAX_COUNTER = Math.pow(COUNTER_BASE, COUNTER_LENGTH) - 1;
export const CLOCK_PRECISION = 60 * 1000; //  1 minute
// This is the size of a base 3 max timestamp with precision 1
// We could probably compute a smaller safe size with CLOCK_PRECISION...
export const MERKLE_KEY_LENGTH = 26;

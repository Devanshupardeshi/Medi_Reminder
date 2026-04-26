/// <reference types="expo/types" />

// Hermes (the default RN JS engine) provides these as globals,
// but they are not declared in @tsconfig/react-native lib.
declare function atob(input: string): string;
declare function btoa(input: string): string;

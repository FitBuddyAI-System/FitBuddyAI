/* eslint-disable @typescript-eslint/no-namespace */
export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

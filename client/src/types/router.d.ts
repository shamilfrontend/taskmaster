import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    chrome?: boolean;
    public?: boolean;
  }
}

export {};

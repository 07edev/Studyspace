export type AppTabParamList = {
  Home: undefined;
  Explore: undefined;
  Community: undefined;
  Documents: undefined;
  Profile: undefined;
};
export type FeatureId =
  | 'places'
  | 'community'
  | 'documents'
  | 'favorites'
  | 'suggestions'
  | 'my-posts'
  | 'saved-posts'
  | 'my-documents'
  | 'notifications';
export type ModalRoute =
  | { name: 'auth'; mode: 'login' | 'register' }
  | { name: 'auth-required'; reason: string }
  | { name: 'feature'; feature: FeatureId }
  | { name: 'settings' }
  | { name: 'about' };
export type ModalSize = 'C' | 'L' | 'F';

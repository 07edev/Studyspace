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
  | {
      name: 'auth';
      mode: 'login' | 'register' | 'verify' | 'forgot';
      // verify only: the address being verified and seconds until a new code may be requested.
      email?: string;
      resendIn?: number;
    }
  | { name: 'session-ended'; reason: 'expired' | 'suspended' }
  | { name: 'auth-required'; reason: string }
  | { name: 'feature'; feature: FeatureId }
  | { name: 'settings' }
  | { name: 'about' };
export type ModalSize = 'C' | 'L' | 'F';

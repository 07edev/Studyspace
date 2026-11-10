import type { ContactChallenge } from '../shared/contracts/auth';

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
  // U46 edit profile / U05 complete profile right after sign-up.
  | { name: 'profile-edit'; mode?: 'edit' | 'complete' }
  // U47: confirm an email change with the code that was sent.
  | { name: 'contact-verify'; challenge: ContactChallenge }
  | { name: 'settings' }
  | { name: 'change-password' }
  | { name: 'privacy' }
  | { name: 'notifications' }
  | { name: 'logout-confirm' }
  | { name: 'delete-account' }
  | { name: 'about' };
export type ModalSize = 'C' | 'L' | 'F';

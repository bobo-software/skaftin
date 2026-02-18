import SuperTokens from 'supertokens-auth-react';
import Session from 'supertokens-auth-react/recipe/session';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import EmailVerification from 'supertokens-auth-react/recipe/emailverification';
import ThirdParty, { Google, Github, Apple } from 'supertokens-auth-react/recipe/thirdparty';

// In production, VITE_API_URL should point to the Go gateway domain.
// In development, use the frontend's own origin so requests go through the
// Vite dev proxy (configured in vite.config.ts), avoiding CORS issues.
const API_DOMAIN = import.meta.env.VITE_API_URL || window.location.origin;
const WEBSITE_DOMAIN = window.location.origin;

export function initSuperTokensFrontend() {
  SuperTokens.init({
    appInfo: {
      appName: "Skaftin",
      apiDomain: API_DOMAIN,
      websiteDomain: WEBSITE_DOMAIN,
      apiBasePath: "/auth",
      websiteBasePath: "/auth",
    },
    recipeList: [
      EmailPassword.init(),
      // Email Verification - mode should match backend
      // OPTIONAL: allows login without verification, shows reminder
      // REQUIRED: blocks login until email is verified
      EmailVerification.init({
        mode: "OPTIONAL",
      }),
      // Third-Party OAuth - providers are configured on the backend
      // The frontend automatically shows available providers
      ThirdParty.init({
        signInAndUpFeature: {
          providers: [
            Google.init(),
            Github.init(),
            Apple.init(),
          ],
        },
      }),
      Session.init({
        tokenTransferMethod: "cookie",
      }),
    ],
  });
}

// Re-export for backward compatibility
export { Session };

// Export SuperTokensWrapper for use in main.tsx
export { SuperTokensWrapper } from 'supertokens-auth-react';

// Export session hooks for use in components
export { useSessionContext } from 'supertokens-auth-react/recipe/session';

// Export EmailPassword functions for login/signup/password-reset
export { 
  signIn, 
  signUp, 
  signOut,
  sendPasswordResetEmail,
  submitNewPassword,
  getResetPasswordTokenFromURL,
} from 'supertokens-auth-react/recipe/emailpassword';
export { doesSessionExist } from 'supertokens-auth-react/recipe/session';

// Export EmailVerification functions
export { 
  sendVerificationEmail,
  isEmailVerified 
} from 'supertokens-auth-react/recipe/emailverification';

// Export ThirdParty functions for OAuth
export {
  redirectToThirdPartyLogin,
  getAuthorisationURLWithQueryParamsAndSetState,
} from 'supertokens-auth-react/recipe/thirdparty';
export { default as ThirdParty } from 'supertokens-auth-react/recipe/thirdparty';


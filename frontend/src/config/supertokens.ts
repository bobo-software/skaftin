import SuperTokens from 'supertokens-web-js';
import Session from 'supertokens-web-js/recipe/session';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

const API_DOMAIN = import.meta.env.VITE_API_URL || 'http://localhost:4006';
const WEBSITE_DOMAIN = window.location.origin;

export function initSuperTokensFrontend() {
  console.log('🚀 [SuperTokens Init] Initializing SuperTokens...');
  console.log('🚀 [SuperTokens Init] API Domain:', API_DOMAIN);
  console.log('🚀 [SuperTokens Init] Website Domain:', WEBSITE_DOMAIN);
  console.log('🚀 [SuperTokens Init] VITE_API_URL:', import.meta.env.VITE_API_URL);
  
  SuperTokens.init({
    appInfo: {
      appName: "Skaftin",
      apiDomain: API_DOMAIN,
      apiBasePath: "/auth",
    },
    recipeList: [
      EmailPassword.init(),
      Session.init({
        tokenTransferMethod: "cookie",
      }),
    ],
  });
  
  console.log('✅ [SuperTokens Init] SuperTokens initialized successfully');
}

export { Session };


import supertokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Dashboard from "supertokens-node/recipe/dashboard";
import { TypeInput } from "supertokens-node/types";

export function initSuperTokens() {
  // Detect if we're in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Determine cookie settings based on environment
  const cookieSettings = {
    // For production with subdomains (skaftin.bobosoftware.co.za & skaftinplatform.bobosoftware.co.za)
    cookieSameSite: isProduction ? "none" as const : "lax" as const,
    cookieSecure: isProduction, // true in production (HTTPS required)
    cookieDomain: process.env.COOKIE_DOMAIN || undefined, // .bobosoftware.co.za in production
    olderCookieDomain: process.env.OLDER_COOKIE_DOMAIN || undefined, // Clear old cookies if domain changed
  };

  const config: TypeInput = {
    framework: "express",
    supertokens: {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || "http://localhost:3567",
      apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    appInfo: {
      appName: process.env.SUPERTOKENS_APP_NAME || "Skaftin",
      apiDomain: process.env.SUPERTOKENS_API_DOMAIN || "http://localhost:4006",
      websiteDomain: process.env.SUPERTOKENS_WEBSITE_DOMAIN || "http://localhost:3005",
      apiBasePath: "/auth",
      websiteBasePath: "/auth",
    },
    recipeList: [
      EmailPassword.init({
        signUpFeature: {
          formFields: [
            {
              id: "name",
              optional: true,
            },
          ],
        },
        override: {
          apis: (originalImplementation) => {
            return {
              ...originalImplementation,
              signUpPOST: async function (input) {
                if (originalImplementation.signUpPOST === undefined) {
                  throw Error("Should never come here");
                }

                // Call the original implementation
                let response = await originalImplementation.signUpPOST(input);

                // If sign up was successful
                if (response.status === "OK") {
                  console.log("New user signed up:", response.user.id);
                  
                  // You can add custom logic here, like:
                  // - Send welcome email
                  // - Create user profile in your database
                  // - Set up initial user data
                }

                return response;
              },
              signInPOST: async function (input) {
                if (originalImplementation.signInPOST === undefined) {
                  throw Error("Should never come here");
                }

                // Call the original implementation
                let response = await originalImplementation.signInPOST(input);

                // If sign in was successful
                if (response.status === "OK") {
                  console.log("User signed in:", response.user.id);
                }

                return response;
              },
            };
          },
        },
      }),
      Session.init({
        ...cookieSettings,
        sessionExpiredStatusCode: 401,
        getTokenTransferMethod: () => "cookie", // FORCE cookie-based sessions
        override: {
          functions: (originalImplementation) => {
            return {
              ...originalImplementation,
              createNewSession: async function (input) {
                // Add custom claims to session
                const userId = input.userId;
                
                // Fetch user's projects from database
                // This will be populated after we integrate with your projects table
                input.accessTokenPayload = {
                  ...input.accessTokenPayload,
                  projectIds: [], // Will be populated from database
                  role: "user", // Default role
                };

                return originalImplementation.createNewSession(input);
              },
            };
          },
        },
      }),
      Dashboard.init({
        apiKey: process.env.SUPERTOKENS_API_KEY,
      }),
    ],
  };

  supertokens.init(config);
}


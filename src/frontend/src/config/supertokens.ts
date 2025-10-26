import { SuperTokensConfig } from "supertokens-auth-react";
import EmailPassword from "supertokens-auth-react/recipe/emailpassword";
import Session from "supertokens-auth-react/recipe/session";

export const supertokensConfig: SuperTokensConfig = {
  appInfo: {
    appName: "Skaftin",
    apiDomain: "http://localhost:4005",
    websiteDomain: "http://localhost:3005",
    apiBasePath: "/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init(),
    Session.init(),
  ],
};

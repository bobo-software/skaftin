import { TypeInput } from "supertokens-node/types";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Session from "supertokens-node/recipe/session";
import { config } from './environment';

export const SuperTokensConfig: TypeInput = {
  framework: "express",
  supertokens: {
    connectionURI: config.supertokens.connectionURI,
    apiKey: config.supertokens.apiKey,
  },
  appInfo: {
    appName: "Skaftin",
    apiDomain: config.backend.url,
    websiteDomain: config.frontend.url,
  },
  recipeList: [
    EmailPassword.init(),
    Session.init(),
  ],
};

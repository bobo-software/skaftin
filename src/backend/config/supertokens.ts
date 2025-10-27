import { TypeInput } from "supertokens-node/types";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import ThirdParty from "supertokens-node/recipe/thirdparty";
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
    apiGatewayPath: "/auth",
  },
  recipeList: [
    EmailPassword.init(),
    ThirdParty.init({
      signInAndUpFeature: {
        providers: [
          {
            config: {
              thirdPartyId: "google",
              clients: [{
                clientId: config.oauth.google.clientId,
                clientSecret: config.oauth.google.clientSecret,
              }]
            }
          },
          {
            config: {
              thirdPartyId: "github",
              clients: [{
                clientId: config.oauth.github.clientId,
                clientSecret: config.oauth.github.clientSecret,
              }]
            }
          }
        ],
      },
    }),
    Session.init(),
  ],
};

/**
 * Handles the SRP authentication flow for the user.
 *
 * Author: Elias Sjödin
 * Created: 2024-10-16
 */

import { AuthBuddy, AuthError, Hub } from "../internal/classes";
import { assert, authErrorStrings } from "../internal/utils/errorUtils";
import { handleUserSRPAuthFlow, getActiveSignInState } from "../internal/utils/signInUtils";
import { cacheTokens } from "../internal/utils/tokenUtils";
import { setActiveSignInState, cleanActiveSignInState } from "../internal/stores/signInStore";
import { getNextStepFromChallenge } from "../internal/nextStepHandlers";
import type { CognitoResponse, SignInInput } from "../types/authTypes";

export const signInWithSRP = async (input: SignInInput) => {
  const { username, password } = input;
  const signInDetails = {
    loginId: username,
    authFlowType: "USER_SRP_AUTH"
  };

  assert(!!username, "EmptyUsernameException", authErrorStrings.EmptyUsernameException);
  assert(!!password, "EmptyPasswordException", authErrorStrings.EmptyPasswordException);

  try {
    const cognitoConfig = AuthBuddy.getConfig().Auth.Cognito;
    const {
      ChallengeName: challengeName,
      ChallengeParameters: challengeParameters,
      AuthenticationResult: authenticationResult,
      Session: session
    } = await handleUserSRPAuthFlow({
      username,
      password,
      cognitoConfig
    });

    if (!challengeName) {
      throw new AuthError({
        name: "MissingChallengeNameException",
        message: authErrorStrings.MissingChallengeNameException
      });
    }

    const activeUsername = getActiveSignInState(username);
    setActiveSignInState({
			signInSession: session,
			username: activeUsername,
			challengeName,
			signInDetails,
    });

    if (authenticationResult) {
      cleanActiveSignInState();
      cacheTokens({
        username: activeUsername,
        authenticationResult,
        /*
        NewDeviceMetadata: await getNewDeviceMetatada(
					cognitoConfig.userPoolId,
					authenticationResult.NewDeviceMetadata,
					authenticationResult.AccessToken,
				),
        */
        signInDetails
      });

      /*
      Hub.dispatch("auth", {
        event: "signedIn",
        data: await getCurrentSession(),
      });
      */

      return {
        isSignedIn: true,
        nextStep: { signInStep: "DONE" }
      };
    }

    return getNextStepFromChallenge(
      challengeName,
      challengeParameters as unknown as CognitoResponse
    );
  } catch (err) {
    console.log("aaauth:", err);
  }
}

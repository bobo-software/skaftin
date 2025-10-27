import { signUp, signIn } from "supertokens-auth-react/recipe/emailpassword";
import { signOut } from "supertokens-auth-react/recipe/session";
import { doesSessionExist, getUserId } from "supertokens-auth-react/recipe/session";
import ThirdParty from "supertokens-auth-react/recipe/thirdparty";

class AuthService {
  // Login user
  static async login(email: string, password: string): Promise<any> {
    try {
      const response = await signIn({
        formFields: [{ id: "email", value: email }, { id: "password", value: password }],
      });
      
      console.log('📥 Login response:', response);
      
      // Check if the response has a status field
      if (response && 'status' in response) {
        // Success case
        if (response.status === 'OK' && 'user' in response && response.user) {
          // Extract email from response - SuperTokens stores it in emails array
          const userEmail = response.user.emails?.[0] || email;
          
          console.log('👤 User email extracted:', userEmail);
          
          return {
            success: true,
            user: { email: userEmail, id: response.user.id },
          };
        }
        
        // Error case: Wrong credentials
        if (response.status === 'WRONG_CREDENTIALS_ERROR') {
          return {
            success: false,
            error: 'Incorrect email or password. Please try again.',
          };
        }
        
        // Handle other error statuses
        return {
          success: false,
          error: 'Login failed. Please try again.',
        };
      }
      
      // Check if response has a user property (success case without status field)
      if (response && 'user' in response && response.user) {
        // Extract email from response - SuperTokens stores it in emails array
        const userEmail = response.user.emails?.[0] || email;
        
        console.log('👤 User email extracted:', userEmail);
        
        return {
          success: true,
          user: { email: userEmail, id: response.user.id },
        };
      }
      
      // If we get here, something unexpected happened
      return {
        success: false,
        error: 'Login failed. Please try again.',
      };
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      // Handle SuperTokens validation errors
      if (error.formFields && error.formFields.length > 0) {
        const fieldErrors = error.formFields.map((field: any) => field.error).join(', ');
        return {
          success: false,
          error: fieldErrors,
          formErrors: error.formFields,
        };
      }
      
      return {
        success: false,
        error: error.message || 'Login failed. Please try again.',
      };
    }
  }

  // Register user
  static async register(email: string, password: string): Promise<any> {
    try {
      const response = await signUp({
        formFields: [{ id: "email", value: email }, { id: "password", value: password }],
      });
      
      console.log('📥 Register response:', response);
      
      // Check if the response has a status field
      if (response && 'status' in response) {
        // Success case
        if (response.status === 'OK' && 'user' in response && response.user) {
          // Extract email from response - SuperTokens stores it in emails array
          const userEmail = response.user.emails?.[0] || email;
          
          console.log('👤 User email extracted:', userEmail);
          
          return {
            success: true,
            user: { email: userEmail, id: response.user.id },
          };
        }
        
        // Field validation errors
        if (response.status === 'FIELD_ERROR' && 'formFields' in response && response.formFields) {
          const fieldErrors = response.formFields.map((field: any) => field.error).join(', ');
          return {
            success: false,
            error: fieldErrors,
            formErrors: response.formFields,
          };
        }
        
        // Handle other error statuses
        return {
          success: false,
          error: 'Registration failed. Please try again.',
        };
      }
      
      // Check if response has a user property (success case without status field)
      if (response && 'user' in response && response.user) {
        // Extract email from response - SuperTokens stores it in emails array
        const userEmail = response.user.emails?.[0] || email;
        
        console.log('👤 User email extracted:', userEmail);
        
        return {
          success: true,
          user: { email: userEmail, id: response.user.id },
        };
      }
      
      // If we get here, something unexpected happened
      return {
        success: false,
        error: 'Registration failed. Please try again.',
      };
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      
      // Handle SuperTokens validation errors
      if (error.formFields && error.formFields.length > 0) {
        const fieldErrors = error.formFields.map((field: any) => field.error).join(', ');
        return {
          success: false,
          error: fieldErrors,
          formErrors: error.formFields,
        };
      }
      
      return {
        success: false,
        error: error.message || 'Registration failed',
      };
    }
  }

  // Logout user
  static async logout(): Promise<void> {
    console.log('🔐 AuthService.logout() called');
    try {
      console.log('📤 Calling SuperTokens signOut()...');
      await signOut();
      console.log('✅ SuperTokens signOut() completed successfully');
    } catch (error) {
      console.error('❌ Error during signOut():', error);
      throw error;
    }
  }

  // Check if user is authenticated
  static async isAuthenticated(): Promise<boolean> {
    return await doesSessionExist();
  }

  // Get current user ID
  static async getCurrentUserId(): Promise<string | undefined> {
    try {
      return await getUserId();
    } catch (error) {
      console.error('Error getting user ID:', error);
      return undefined;
    }
  }

  // OAuth sign in with Google
  static async signInWithGoogle(): Promise<void> {
    try {
      // Redirect to Google OAuth
      await ThirdParty.redirectToThirdPartyLogin({
        thirdPartyId: 'google'
      });
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  }

  // OAuth sign in with GitHub
  static async signInWithGithub(): Promise<void> {
    try {
      // Redirect to GitHub OAuth
      await ThirdParty.redirectToThirdPartyLogin({
        thirdPartyId: 'github'
      });
    } catch (error) {
      console.error('GitHub sign in error:', error);
      throw error;
    }
  }

  // Handle OAuth callback (automatically handled by SuperTokens)
  static async handleOAuthCallback(): Promise<any> {
    try {
      // This is automatically handled by SuperTokens when the user returns from OAuth
      // We just need to check if session exists
      const sessionExists = await doesSessionExist();
      
      if (sessionExists) {
        const userId = await getUserId();
        return {
          success: true,
          userId,
        };
      }
      
      return {
        success: false,
        error: 'OAuth authentication failed',
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return {
        success: false,
        error: 'OAuth callback failed',
      };
    }
  }
}

export default AuthService;

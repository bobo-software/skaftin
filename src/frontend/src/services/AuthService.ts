import { signUp, signIn } from "supertokens-auth-react/recipe/emailpassword";
import { signOut } from "supertokens-auth-react/recipe/session";
import { doesSessionExist } from "supertokens-auth-react/recipe/session";

class AuthService {
  // Login user
  static async login(email: string, password: string): Promise<any> {
    try {
      const response = await signIn({
        formFields: [{ id: "email", value: email }, { id: "password", value: password }],
      });
      
      console.log('📥 Login response:', response);
      
      // Extract email from response - SuperTokens might store it in different places
      const userEmail = response.user?.emails?.[0] || response.user?.email || email;
      
      console.log('👤 User email extracted:', userEmail);
      
      return {
        success: true,
        user: { email: userEmail, id: response.user.id },
      };
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      // Handle SuperTokens WRONG_CREDENTIALS_ERROR
      if (error.type === 'WRONG_CREDENTIALS_ERROR' || error.status === 'WRONG_CREDENTIALS_ERROR') {
        return {
          success: false,
          error: 'Incorrect email or password. Please try again.',
        };
      }
      
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
        error: error.message || 'Login failed',
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
      
      // Extract email from response - SuperTokens might store it in different places
      const userEmail = response.user?.emails?.[0] || response.user?.email || email;
      
      console.log('👤 User email extracted:', userEmail);
      
      return {
        success: true,
        user: { email: userEmail, id: response.user.id },
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
}

export default AuthService;

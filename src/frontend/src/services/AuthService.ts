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
      
      // Check if the response has a status field
      if (response && 'status' in response) {
        // Success case
        if (response.status === 'OK' && response.user) {
          // Extract email from response - SuperTokens might store it in different places
          const userEmail = response.user.emails?.[0] || response.user.email || email;
          
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
      if (response && response.user) {
        // Extract email from response - SuperTokens might store it in different places
        const userEmail = response.user.emails?.[0] || response.user.email || email;
        
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
        if (response.status === 'OK' && response.user) {
          // Extract email from response - SuperTokens might store it in different places
          const userEmail = response.user.emails?.[0] || response.user.email || email;
          
          console.log('👤 User email extracted:', userEmail);
          
          return {
            success: true,
            user: { email: userEmail, id: response.user.id },
          };
        }
        
        // Field validation errors
        if (response.status === 'FIELD_ERROR' && response.formFields) {
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
      if (response && response.user) {
        // Extract email from response - SuperTokens might store it in different places
        const userEmail = response.user.emails?.[0] || response.user.email || email;
        
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
}

export default AuthService;

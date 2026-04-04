import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AuthLayout from './AuthLayout';
import './authenticate.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import type { ProfileResponse } from '../profilePage/Profile.types';
import { authHeaders, getApiUrl } from '../../lib/api';

interface SignInFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface SignInFormErrors {
  email?: string;
  password?: string;
}

interface User {
  id: number;
  email: string;
  name?: string;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

interface AuthResponse {
  session?: Session;
  error?: string;
  msg?: string;
}

const Signin: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [formData, setFormData] = useState<SignInFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [errors, setErrors] = useState<SignInFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleInputChange = (field: keyof SignInFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      field === 'rememberMe' ? event.target.checked : event.target.value;

    setFormData({ ...formData, [field]: value });

    if (errors[field as keyof SignInFormErrors]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: SignInFormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setApiError(null);
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          rememberMe: formData.rememberMe,
        }),
      });

      const raw: unknown = await response.json();
      const data = raw as AuthResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Login failed');
      }

      if (!data.session) {
        throw new Error('Invalid server response');
      }

      const { access_token, refresh_token, expires_in, user } = data.session;

      // Store refresh token (persistent)
      localStorage.setItem('refreshToken', refresh_token);

      // Store access token expiry time
      localStorage.setItem(
        'accessTokenExpiry',
        (Date.now() + expires_in * 1000).toString()
      );

      // Store access token (if you don't have AuthContext yet)
      localStorage.setItem('accessToken', access_token);

      // Optional: store user
      try {
        const profileRes = await fetch(getApiUrl('/api/profile'), {
          method: 'GET',
          headers: authHeaders(access_token),
        });
        if (profileRes.ok) {
          const profileRaw: unknown = await profileRes.json();
          const profileData = profileRaw as ProfileResponse;
          localStorage.setItem('user', JSON.stringify(profileData));
        } else {
          localStorage.setItem('user', JSON.stringify(user));
        }
      } catch {
        localStorage.setItem('user', JSON.stringify(user));
      }

      refreshUser();
      navigate('/', { replace: true });

    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your QuickSwap account"
      footerText="Don't have an account?"
      footerLinkText="Sign Up"
      footerLinkHref="/signup"
    >
      <Box component="form" onSubmit={handleSubmit} className="form">

        {apiError && (
          <Typography color="error" sx={{ mb: 2 }}>
            {apiError}
          </Typography>
        )}

        <TextField
          fullWidth
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={handleInputChange('email')}
          error={!!errors.email}
          helperText={errors.email}
          size="small"
          className="auth-textfield mb-1-5"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailOutlinedIcon className="auth-icon" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={handleInputChange('password')}
          error={!!errors.password}
          helperText={errors.password}
          size="small"
          className="auth-textfield mb-1"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon className="auth-icon" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  size="small"
                >
                  {showPassword ? (
                    <VisibilityOff fontSize="small" />
                  ) : (
                    <Visibility fontSize="small" />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {/* will implement in next sprint */}

        {/* <Box className="auth-remember-row">
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.rememberMe}
                onChange={handleInputChange('rememberMe')}
                size="small"
              />
            }
            label="Remember me"
          />
          <Link href="/forgot-password">
            Forgot Password?
          </Link>
        </Box> */}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          className="auth-button mb-1-5"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </Button>

      </Box>
    </AuthLayout>
  );
};

export default Signin;

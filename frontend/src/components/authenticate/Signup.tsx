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
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AuthLayout from './AuthLayout';
import './authenticate.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useToast } from '../shared';
import type { ProfileResponse } from '../profilePage/Profile.types';
import { authHeaders, getApiUrl } from '../../lib/api';
import { isValidEmail, isValidPhone, validatePassword } from '../../utils/validation';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  mobile: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  mobile?: string;
}

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { error: showError, success: showSuccess } = useToast();
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    mobile: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleInputChange = (field: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({ ...formData, [field]: event.target.value });

    if (errors[field as keyof FormErrors]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.feedback[0] || 'Invalid password';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!isValidPhone(formData.mobile)) {
      newErrors.mobile = 'Please enter a valid mobile number';
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(getApiUrl('/api/auth/signup'), {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            email: formData.email.trim(),
            password: formData.password,
            mobile: formData.mobile.trim(),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const parsed = (await response.json()) as Record<string, unknown>;

        if (!response.ok || parsed.error) {
          const msg = typeof parsed.error === 'string' ? parsed.error : 'Signup failed';
          throw new Error(msg);
        }

        // If backend auto-logs in user, accept either { session: {...} } or flat token fields
        const session =
          parsed.session && typeof parsed.session === 'object'
            ? (parsed.session as {
                access_token?: string;
                refresh_token?: string;
                expires_in?: number;
                user?: unknown;
              })
            : parsed.access_token
              ? {
                  access_token: parsed.access_token as string,
                  refresh_token: parsed.refresh_token as string,
                  expires_in: parsed.expires_in as number,
                  user: parsed.user,
                }
              : null;

        if (session?.access_token) {
          const { access_token, user } = session;
          const refresh_token =
            typeof session.refresh_token === 'string' ? session.refresh_token : '';
          const expires_in =
            typeof session.expires_in === 'number' ? session.expires_in : 0;

          localStorage.setItem('accessToken', access_token);
          localStorage.setItem('refreshToken', refresh_token);
          localStorage.setItem(
            'accessTokenExpiry',
            (Date.now() + expires_in * 1000).toString()
          );

          try {
            const profileRes = await fetch(getApiUrl('/api/profile'), {
              method: 'GET',
              headers: authHeaders(access_token),
              signal: controller.signal,
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

          showSuccess('Account created successfully!', 3000);
          refreshUser();
          navigate('/', { replace: true });
          return;
        }

        // No session: signup likely requires email confirmation
        const successMsg =
          (typeof parsed.message === 'string' && parsed.message) ||
          (typeof parsed.msg === 'string' && parsed.msg) ||
          'Account created successfully. Please sign in.';
        showSuccess(successMsg, 4000);
        navigate('/signin', {
          replace: true,
          state: { signupSuccessMessage: successMsg },
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection and try again.');
        }
        throw err;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Signup failed';
      setApiError(errorMsg);
      showError(errorMsg, 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join QuickSwap and start trading today"
      footerText="Already have an account?"
      footerLinkText="Sign In"
      footerLinkHref="/signin"
      showTerms
    >
      <Box component="form" onSubmit={handleSubmit} className="form">

        {apiError && (
          <Typography color="error" sx={{ mb: 2 }}>
            {apiError}
          </Typography>
        )}

        {/* Name Fields */}
        <Box className="auth-name-row">
          <TextField
            fullWidth
            label="First Name"
            value={formData.firstName}
            onChange={handleInputChange('firstName')}
            error={!!errors.firstName}
            helperText={errors.firstName}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label="Last Name"
            value={formData.lastName}
            onChange={handleInputChange('lastName')}
            error={!!errors.lastName}
            helperText={errors.lastName}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Email */}
        <TextField
          fullWidth
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={handleInputChange('email')}
          error={!!errors.email}
          helperText={errors.email}
          size="small"
          className="mb-1-5"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {/* Mobile */}
        <TextField
          fullWidth
          label="Mobile Number"
          value={formData.mobile}
          onChange={handleInputChange('mobile')}
          error={!!errors.mobile}
          helperText={errors.mobile}
          size="small"
          className="mb-1-5"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PhoneOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {/* Password */}
        <TextField
          fullWidth
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={handleInputChange('password')}
          error={!!errors.password}
          helperText={errors.password}
          size="small"
          className="mb-1-5"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  size="small"
                >
                  {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Confirm Password */}
        <TextField
          fullWidth
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          value={formData.confirmPassword}
          onChange={handleInputChange('confirmPassword')}
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword}
          size="small"
          className="mb-2"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                  size="small"
                >
                  {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Create Account"}
        </Button>

      </Box>
    </AuthLayout>
  );
};

export default Signup;

import React from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Link,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import './authenticate.css';
import { useNavigate } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
  showTerms?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
  showTerms = false,
}) => {
  const navigate = useNavigate();
  return (
    <Box className="auth-container">
      < Container maxWidth="sm">
        <Paper elevation={0} className="auth-paper">

          <Box sx={{
              mb: 1,
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              borderRadius: '999px',
              padding: '4px 10px',
              border: '1px solid var(--auth-borders)',
              '&:hover': {
                backgroundColor: 'var(--auth-section-bg)',
              },
            }}
            onClick={() => navigate('/')}>
            <ArrowBackIosNewIcon fontSize="small" className="auth-back-icon" />
            <Typography variant="body2" className="auth-back-text">
              Home
            </Typography>
          </Box>

          <Box className="auth-header">
            <Typography variant="h5" className="auth-title">
              {title}
            </Typography>
            <Typography variant="body2" className="auth-subtitle">
              {subtitle}
            </Typography>
          </Box>
          {children}
          <Box className="auth-divider">
            <Box className="auth-divider-line" />
            <Typography className="auth-divider-text">
              or
            </Typography>
            <Box className="auth-divider-line" />
          </Box>

          {/* Footer Link */}
          <Box className="auth-footer">
            <Typography variant="body2" className="auth-footer-text">
              {footerText}{' '}
              <Link href={footerLinkHref} className="auth-link">
                {footerLinkText}
              </Link>
            </Typography>
          </Box>

          {/* Terms */}
          {showTerms && (
            <Typography variant="body2" className="auth-terms">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="auth-link">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="auth-link">
                Privacy Policy
              </Link>
            </Typography>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default AuthLayout;


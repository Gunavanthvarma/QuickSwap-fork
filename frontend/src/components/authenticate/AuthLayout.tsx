import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Link,
} from '@mui/material';
import './authenticate.css';
import '../landingPage/landing_page.css';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="auth-page-wrapper">
      <header className="navbar">
        <div
          className="navbar-logo"
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
        >
          <span className="logo-text">Quickswap</span>
        </div>
        <button
          type="button"
          className="navbar-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <nav
          className={`navbar-links ${mobileMenuOpen ? 'mobile-open' : ''}`}
          aria-label="Primary"
          role="navigation"
        >
          <a href="/#features" onClick={() => setMobileMenuOpen(false)}>How it works</a>
          <a href="/#auctions" onClick={() => setMobileMenuOpen(false)}>Live auctions</a>
        </nav>
        <div className="navbar-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigate(footerLinkHref)}
          >
            {footerLinkText}
          </button>
        </div>
      </header>

      <div className="auth-content">
        <Container maxWidth="sm">
          <Paper elevation={0} className="auth-paper">
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
              <Typography className="auth-divider-text">or</Typography>
              <Box className="auth-divider-line" />
            </Box>

            <Box className="auth-footer">
              <Typography variant="body2" className="auth-footer-text">
                {footerText}{' '}
                <Link href={footerLinkHref} className="auth-link">
                  {footerLinkText}
                </Link>
              </Typography>
            </Box>

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
      </div>
    </div>
  );
};

export default AuthLayout;

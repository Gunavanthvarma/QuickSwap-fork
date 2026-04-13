import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ListingsTab, BidsTab, ProfileHeader, ProfileTabs, SettingsTab } from '../Profilecomponents';
import { BrowserRouter } from 'react-router-dom';
import type { ListingCardItem, BidCardItem } from '../Profile.types';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Profile Components', () => {
    describe('ListingsTab', () => {
        const mockListings: ListingCardItem[] = [
            {
                id: '1',
                name: 'Test Listing',
                image: 'test.jpg',
                currentBid: '$100',
                timeLeft: '1h',
                bids: 5,
                status: 'active',
            },
        ];

        it('renders loading state', () => {
            render(<ListingsTab listings={[]} loading={true} error={null} />, { wrapper: BrowserRouter });
            expect(screen.getByText(/loading your listings/i)).toBeInTheDocument();
        });

        it('renders error state', () => {
            render(<ListingsTab listings={[]} loading={false} error="Error message" />, { wrapper: BrowserRouter });
            expect(screen.getByText(/error message/i)).toBeInTheDocument();
        });

        it('renders empty state with CTA when there are no listings', () => {
            render(<ListingsTab listings={[]} loading={false} error={null} />, { wrapper: BrowserRouter });
            expect(screen.getByText(/no listings yet/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /start your first listing/i })).toBeInTheDocument();
        });

        it('renders list of listings', () => {
            render(<ListingsTab listings={mockListings} loading={false} error={null} />, { wrapper: BrowserRouter });
            expect(screen.getByText('Test Listing')).toBeInTheDocument();
            expect(screen.getByText('$100')).toBeInTheDocument();
        });

        it('navigates when a listing card is clicked', () => {
            render(<ListingsTab listings={mockListings} loading={false} error={null} />, { wrapper: BrowserRouter });
            const card = screen.getByRole('button', { name: /open auction: test listing/i });
            fireEvent.click(card);
            expect(mockNavigate).toHaveBeenCalledWith('/auction/1');
        });
    });

    describe('BidsTab', () => {
        const mockBids: BidCardItem[] = [
            {
                id: 'b1',
                name: 'Test Bid',
                image: 'bid.jpg',
                yourBid: '$50',
                currentBid: '$60',
                timeLeft: '30m',
                status: 'winning',
            },
        ];

        it('renders empty state with CTA when there are no bids', () => {
            render(<BidsTab bids={[]} loading={false} error={null} />, { wrapper: BrowserRouter });
            expect(screen.getByRole('button', { name: /browse live auctions/i })).toBeInTheDocument();
        });

        it('renders list of bids', () => {
            render(<BidsTab bids={mockBids} loading={false} error={null} />, { wrapper: BrowserRouter });
            expect(screen.getByText('Test Bid')).toBeInTheDocument();
            expect(screen.getByText('$50')).toBeInTheDocument();
        });

        it('navigates when a bid card is clicked', () => {
            render(<BidsTab bids={mockBids} loading={false} error={null} />, { wrapper: BrowserRouter });
            const card = screen.getByRole('button', { name: /open auction: test bid/i });
            fireEvent.click(card);
            expect(mockNavigate).toHaveBeenCalledWith('/auction/b1');
        });
    });

    describe('ProfileHeader', () => {
        const mockUser = {
            id: 'u1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            created_at: '2025-03-15T12:00:00.000Z',
        };
        it('renders user info', () => {
            render(<ProfileHeader user={mockUser} displayName="Test User" />);
            expect(screen.getByText('Test User')).toBeInTheDocument();
            expect(screen.getByText('test@example.com')).toBeInTheDocument();
            expect(screen.getByText('TU')).toBeInTheDocument();
            expect(screen.getByText('Member since')).toBeInTheDocument();
            const memberRow = screen.getByText('Member since').closest('.profile-detail-item');
            expect(memberRow?.querySelector('dd')?.textContent).toMatch(/2025/);
        });
    });

    describe('ProfileTabs', () => {
        it('calls onTabChange when a tab is clicked', () => {
            const onTabChange = vi.fn();
            render(<ProfileTabs activeTab="listings" onTabChange={onTabChange} />);
            fireEvent.click(screen.getByText(/my bids/i));
            expect(onTabChange).toHaveBeenCalledWith('bids');
        });
    });

    describe('SettingsTab', () => {
        it('calls onEditProfile when edit button is clicked', () => {
            const onEditProfile = vi.fn();
            const onUpdatePassword = vi.fn();
            const onDeleteAccount = vi.fn();
            render(
                <SettingsTab
                    onEditProfile={onEditProfile}
                    onUpdatePassword={onUpdatePassword}
                    onDeleteAccount={onDeleteAccount}
                />
            );
            fireEvent.click(screen.getByText(/edit profile/i));
            expect(onEditProfile).toHaveBeenCalled();
        });

        it('calls onUpdatePassword when update password button is clicked', () => {
            const onEditProfile = vi.fn();
            const onUpdatePassword = vi.fn();
            const onDeleteAccount = vi.fn();
            render(
                <SettingsTab
                    onEditProfile={onEditProfile}
                    onUpdatePassword={onUpdatePassword}
                    onDeleteAccount={onDeleteAccount}
                />
            );
            fireEvent.click(screen.getByText(/update password/i));
            expect(onUpdatePassword).toHaveBeenCalled();
        });

        it('calls onDeleteAccount when delete account button is clicked', () => {
            const onEditProfile = vi.fn();
            const onUpdatePassword = vi.fn();
            const onDeleteAccount = vi.fn();
            render(
                <SettingsTab
                    onEditProfile={onEditProfile}
                    onUpdatePassword={onUpdatePassword}
                    onDeleteAccount={onDeleteAccount}
                />
            );
            fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
            expect(onDeleteAccount).toHaveBeenCalled();
        });
    });
});

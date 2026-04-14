import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { NotificationsBell } from "../NotificationsBell";
import type { NotificationItem } from "../../../lib/listingApi";

const mocks = vi.hoisted(() => ({
  isAuthenticated: true,
  fetchNotifications: vi.fn(),
  fetchUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  redirectToSignin: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("../../../auth/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));

vi.mock("../../../auth/useSignInRedirect", () => ({
  useSignInRedirect: () => mocks.redirectToSignin,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../../../lib/listingApi", () => ({
  fetchNotifications: mocks.fetchNotifications,
  fetchUnreadNotificationCount: mocks.fetchUnreadNotificationCount,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
  markNotificationRead: mocks.markNotificationRead,
}));

const sampleNotif: NotificationItem = {
  id: "n1",
  user_id: "u1",
  type: "test",
  title: "Bid update",
  message: "You were outbid",
  listing_id: "listing-99",
  is_read: false,
  created_at: "2026-04-01T12:00:00.000Z",
};

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationsBell />
    </MemoryRouter>,
  );
}

describe("NotificationsBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.isAuthenticated = true;
    mocks.fetchUnreadNotificationCount.mockResolvedValue(0);
    mocks.fetchNotifications.mockResolvedValue([]);
    mocks.markAllNotificationsRead.mockResolvedValue(undefined);
    mocks.markNotificationRead.mockResolvedValue(undefined);
  });

  it("renders nothing when not authenticated", () => {
    mocks.isAuthenticated = false;
    const { container } = render(
      <BrowserRouter>
        <NotificationsBell />
      </BrowserRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows unread badge when count is between 1 and 99", async () => {
    localStorage.setItem("accessToken", "tok");
    mocks.fetchUnreadNotificationCount.mockResolvedValue(3);
    renderBell();
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("shows 99+ when unread count exceeds 99", async () => {
    localStorage.setItem("accessToken", "tok");
    mocks.fetchUnreadNotificationCount.mockResolvedValue(150);
    renderBell();
    await waitFor(() => {
      expect(screen.getByText("99+")).toBeInTheDocument();
    });
  });

  it("opens panel and loads notifications when bell is clicked", async () => {
    localStorage.setItem("accessToken", "tok");
    mocks.fetchNotifications.mockResolvedValue([sampleNotif]);
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() => {
      expect(mocks.fetchNotifications).toHaveBeenCalledWith("tok");
    });
    expect(await screen.findByText("Bid update")).toBeInTheDocument();
    expect(screen.getByText("You were outbid")).toBeInTheDocument();
  });

  it("calls redirect when opening without token", () => {
    localStorage.removeItem("accessToken");
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(mocks.redirectToSignin).toHaveBeenCalled();
  });

  it("marks all read and clears badge", async () => {
    localStorage.setItem("accessToken", "tok");
    mocks.fetchNotifications.mockResolvedValue([{ ...sampleNotif, is_read: false }]);
    mocks.fetchUnreadNotificationCount.mockResolvedValue(1);
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await screen.findByText("Mark all read");
    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }));
    await waitFor(() => {
      expect(mocks.markAllNotificationsRead).toHaveBeenCalledWith("tok");
    });
  });

  it("navigates to auction when notification is activated", async () => {
    localStorage.setItem("accessToken", "tok");
    mocks.fetchNotifications.mockResolvedValue([sampleNotif]);
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    const row = await screen.findByText("Bid update");
    fireEvent.click(row.closest("button")!);
    await waitFor(() => {
      expect(mocks.markNotificationRead).toHaveBeenCalledWith("tok", "n1");
      expect(mocks.navigate).toHaveBeenCalledWith("/auction/listing-99");
    });
  });

  it("shows error message when fetch fails", async () => {
    localStorage.setItem("accessToken", "tok");
    mocks.fetchNotifications.mockRejectedValue(new Error("network down"));
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("network down");
  });
});

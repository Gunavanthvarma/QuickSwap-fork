import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { BidsTab } from "../Profilecomponents";
import { ProfileHeaderCharts } from "../ProfileHeaderCharts";
import type { BidCardItem, ListingCardItem } from "../Profile.types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Profile status visuals", () => {
  it("shows Won and Bid more labels in My Bids cards", () => {
    const bids: BidCardItem[] = [
      {
        id: "listing-1",
        name: "Won listing",
        image: "won.jpg",
        yourBid: "$120",
        currentBid: "$120",
        timeLeft: "Ended",
        status: "won",
      },
      {
        id: "listing-2",
        name: "Outbid listing",
        image: "outbid.jpg",
        yourBid: "$95",
        currentBid: "$110",
        timeLeft: "2h",
        status: "bid_more",
      },
    ];

    render(<BidsTab bids={bids} loading={false} error={null} />, {
      wrapper: BrowserRouter,
    });

    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(screen.getByText("Bid more")).toBeInTheDocument();
    expect(screen.getByText("Place higher bid")).toBeInTheDocument();
  });

  it("splits listings chart into Sold and Unsold", () => {
    const listings: ListingCardItem[] = [
      {
        id: "l1",
        name: "Sold listing",
        image: "",
        currentBid: "$220",
        timeLeft: "Ended",
        bids: 4,
        status: "sold",
      },
      {
        id: "l2",
        name: "Unsold listing",
        image: "",
        currentBid: "$0",
        timeLeft: "Ended",
        bids: 0,
        status: "unsold",
      },
    ];

    const bids: BidCardItem[] = [];

    render(
      <ProfileHeaderCharts
        listings={listings}
        bids={bids}
        listingsLoading={false}
        bidsLoading={false}
      />,
    );

    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.getByText("Unsold")).toBeInTheDocument();
    expect(screen.getByLabelText(/listings: sold 1, unsold 1/i)).toBeInTheDocument();
  });
});

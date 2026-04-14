import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProfileHeaderCharts } from "../ProfileHeaderCharts";
import type { BidCardItem, ListingCardItem } from "../Profile.types";

const listings: ListingCardItem[] = [
  {
    id: "1",
    name: "A",
    image: "",
    currentBid: "$1",
    timeLeft: "1h",
    bids: 1,
    status: "active",
  },
  {
    id: "2",
    name: "B",
    image: "",
    currentBid: "$2",
    timeLeft: "0",
    bids: 0,
    status: "sold",
  },
];

const bids: BidCardItem[] = [
  {
    id: "b1",
    name: "X",
    image: "",
    yourBid: "$1",
    currentBid: "$2",
    timeLeft: "1h",
    status: "winning",
  },
  {
    id: "b2",
    name: "Y",
    image: "",
    yourBid: "$1",
    currentBid: "$5",
    timeLeft: "0",
    status: "outbid",
  },
  {
    id: "b3",
    name: "Z",
    image: "",
    yourBid: "$1",
    currentBid: "$9",
    timeLeft: "0",
    status: "lost",
  },
];

describe("ProfileHeaderCharts", () => {
  it("shows loading placeholders when listings or bids are loading", () => {
    render(
      <ProfileHeaderCharts
        listings={[]}
        bids={[]}
        listingsLoading={true}
        bidsLoading={true}
      />,
    );
    const regions = screen.getAllByRole("img");
    expect(regions).toHaveLength(2);
    for (const r of regions) {
      expect(within(r).getAllByText("Loading…").length).toBeGreaterThanOrEqual(1);
    }
  });

  it("shows empty hints when not loading and no data", () => {
    render(
      <ProfileHeaderCharts
        listings={[]}
        bids={[]}
        listingsLoading={false}
        bidsLoading={false}
      />,
    );
    expect(screen.getByLabelText(/listings: no listings yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bids: no bids yet/i)).toBeInTheDocument();
  });

  it("renders legend counts for listings and bids", () => {
    render(
      <ProfileHeaderCharts
        listings={listings}
        bids={bids}
        listingsLoading={false}
        bidsLoading={false}
      />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.getByLabelText(/listings: active 1, sold 1/i)).toBeInTheDocument();

    expect(screen.getByText("Winning")).toBeInTheDocument();
    expect(screen.getByText("Outbid")).toBeInTheDocument();
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(screen.getByLabelText(/bids: winning 1, outbid 1, lost 1/i)).toBeInTheDocument();
  });
});

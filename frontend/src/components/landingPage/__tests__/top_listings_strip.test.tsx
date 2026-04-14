import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TopListingsStrip, { StripEmptyStateView } from "../top_listings_strip";

describe("TopListingsStrip", () => {
  it("returns null when hideWhenEmpty and items empty", () => {
    const { container } = render(
      <TopListingsStrip
        title="Featured"
        items={[]}
        hideWhenEmpty
        onViewItem={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows plain empty text when no items and no emptyState", () => {
    render(
      <TopListingsStrip
        title="Ending soon"
        items={[]}
        onViewItem={vi.fn()}
        emptyText="Nothing here."
      />,
    );
    expect(screen.getByRole("heading", { name: /ending soon/i })).toBeInTheDocument();
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders rich empty state when provided", () => {
    const onCta = vi.fn();
    render(
      <TopListingsStrip
        title="Your listings"
        items={[]}
        onViewItem={vi.fn()}
        emptyState={{
          illustration: "first-listing",
          title: "Start selling",
          description: "Create your first listing.",
          ctaLabel: "Go",
          onCta,
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: /start selling/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^go$/i }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it("renders cards and calls onViewItem with id", () => {
    const onViewItem = vi.fn();
    render(
      <TopListingsStrip
        title="Live"
        items={[
          {
            id: "item-1",
            name: "Camera",
            price: "$10",
            image: "/x.jpg",
            tag: "New",
          },
        ]}
        onViewItem={onViewItem}
      />,
    );
    fireEvent.click(screen.getByRole("heading", { name: /camera/i }));
    expect(onViewItem).toHaveBeenCalledWith("item-1");
  });

  it("shows Show all when onShowAll provided and items exist", () => {
    const onShowAll = vi.fn();
    render(
      <TopListingsStrip
        title="Trending"
        items={[
          {
            id: "a",
            name: "One",
            price: "$1",
            image: "/a.jpg",
            tag: "Hot",
          },
        ]}
        onViewItem={vi.fn()}
        onShowAll={onShowAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show all trending/i }));
    expect(onShowAll).toHaveBeenCalled();
  });

  it("omits Show all when empty", () => {
    render(
      <TopListingsStrip title="Empty strip" items={[]} onViewItem={vi.fn()} onShowAll={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
  });
});

describe("StripEmptyStateView", () => {
  it("applies cta-only class when title and description missing", () => {
    const { container } = render(
      <StripEmptyStateView
        config={{
          illustration: "latest",
          ctaLabel: "Browse",
          onCta: vi.fn(),
        }}
      />,
    );
    expect(container.querySelector(".strip-empty--cta-only")).toBeInTheDocument();
  });
});

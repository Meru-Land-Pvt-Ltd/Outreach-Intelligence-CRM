import { ReviewsTable } from "@/components/reviews/reviews-table";

export default function EnoylityReviewsPage() {
  return (
    <ReviewsTable
      title="Enoylity Reviews"
      description="Latest uploads from Enoylity Technology."
      endpoint="/reviews/enoylity"
    />
  );
}
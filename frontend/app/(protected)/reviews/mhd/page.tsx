import { ReviewsTable } from "@/components/reviews/reviews-table";

export default function MhdReviewsPage() {
  return (
    <ReviewsTable
      title="MHD Tech Reviews"
      description="Latest uploads from MHD Tech."
      endpoint="/reviews/mhd"
    />
  );
}
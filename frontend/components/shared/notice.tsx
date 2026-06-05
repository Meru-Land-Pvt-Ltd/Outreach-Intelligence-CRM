import { Alert, AlertDescription } from "@/components/ui/alert";

type NoticeProps = {
  type: "success" | "error";
  text: string;
};

export function Notice({ type, text }: NoticeProps) {
  return (
    <Alert
      className={
        type === "success"
          ? "mt-4 border-emerald-200 bg-emerald-50 text-emerald-800"
          : "mt-4 border-red-200 bg-red-50 text-red-800"
      }
    >
      <AlertDescription className="text-sm font-medium">{text}</AlertDescription>
    </Alert>
  );
}
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

// The error pattern from docs/UI_GUIDE.md §8: a message picked by error code + "Try again".
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-sm text-danger">
        {errorMessage(error)}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

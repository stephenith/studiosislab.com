import EditorShell from "@/components/editor/EditorShell";
import { EditorAuthGate } from "@/components/editor/EditorAuthGate";
import EditorMobileGuard from "@/components/editor/EditorMobileGuard";

export default function EditorRootPage() {
  return (
    <EditorAuthGate>
      <EditorMobileGuard>
        <div className="h-screen flex flex-col">
          <EditorShell variant="new" />
        </div>
      </EditorMobileGuard>
    </EditorAuthGate>
  );
}

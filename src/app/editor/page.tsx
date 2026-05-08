import EditorShell from "@/components/editor/EditorShell";
import { EditorAuthGate } from "@/components/editor/EditorAuthGate";

export default function EditorRootPage() {
  return (
    <EditorAuthGate>
      <div className="h-screen flex flex-col">
        <EditorShell variant="new" />
      </div>
    </EditorAuthGate>
  );
}

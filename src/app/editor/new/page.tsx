import EditorShell from "@/components/editor/EditorShell";

export default function NewEditorPage() {
  return (
    <div className="h-screen flex flex-col">
      <EditorShell mode="new" />
    </div>
  );
}
